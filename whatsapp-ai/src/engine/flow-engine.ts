import axios from 'axios';
import { FlowConfig, FlowNode, FlowSession, AiConfig } from '../types/flow.js';
import { getCachedSession, setCachedSession, deleteCachedSession } from './session-store.js';
import { handleTriage } from '../handlers/triage.js';
import { handleCollect } from '../handlers/collect.js';
import { handleSituational } from '../handlers/situational.js';
import { handleChoice } from '../handlers/choice.js';
import { handleVision } from '../handlers/vision.js';
import { handleAction } from '../handlers/action.js';
import { handleEnd } from '../handlers/end.js';

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'gestorprint-internal-2026';
const internalHeaders = { 'x-internal-key': INTERNAL_KEY };

export class FlowEngine {
  constructor(
    private erpUrl: string,
    private aiConfig: AiConfig,
    private inlineFlowConfig?: FlowConfig, // used by preview (unsaved canvas state)
  ) {}

  async processMessage(
    phone: string,
    text: string,
    mediaBase64?: string,
    mediaMime?: string,
  ): Promise<string> {
    const tenantId = this.aiConfig.tenantId;

    // 1. Load flow config
    const flowConfig = await this.loadFlowConfig(tenantId);
    if (!flowConfig || flowConfig.nodes.length === 0) {
      return 'Olá! Nosso sistema de atendimento está sendo configurado. Em breve estaremos disponíveis!';
    }

    // 2. Load or create session
    let session = await this.loadSession(tenantId, phone, flowConfig);

    // 3. Loop: process nodes until we have a response to return (handles silent advances)
    const MAX_HOPS = 10; // safety limit against infinite loops in bad flow configs
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      let node = flowConfig.nodes.find(n => n.id === session.currentNodeId);
      if (!node) {
        const startNode = this.findStartNode(flowConfig);
        if (!startNode) return 'Fluxo de atendimento não configurado corretamente.';
        session = { currentNodeId: startNode.id, collectedData: {} };
        node = startNode;
      }

      console.log(`[FLOW] tenant=${tenantId} phone=${phone} node=${node.id} type=${node.type}`);

      // 4. Dispatch to handler
      const result = await this.dispatch(node, flowConfig, session, text, mediaBase64, mediaMime);

      // 5. Merge collected data
      if (result.updatedData) {
        session.collectedData = { ...session.collectedData, ...result.updatedData };
      }

      // 6. Handle pending flags
      if (result.clearPendingChoice) session.pendingChoice = null;
      if (result.setPendingChoice) session.pendingChoice = result.setPendingChoice;
      if (result.clearPendingSituational) session.pendingSituational = null;
      if (result.setPendingSituational) session.pendingSituational = result.setPendingSituational;

      // 7. Advance or end session
      if (result.nextNodeId) {
        const nextNode = flowConfig.nodes.find(n => n.id === result.nextNodeId);
        if (nextNode?.type === 'end') {
          const endResult = await handleEnd(nextNode);
          await this.deleteSession(tenantId, phone);
          // If current node had a response (e.g. action confirmMessage), show both
          if (result.responseText) {
            return result.responseText + (endResult.responseText ? '\n\n' + endResult.responseText : '');
          }
          return endResult.responseText;
        }
        session.currentNodeId = result.nextNodeId;
        await this.saveSession(tenantId, phone, session);
      } else {
        await this.saveSession(tenantId, phone, session);
      }

      // 8. If we have a response, return it; otherwise continue to next node (silent advance)
      if (result.responseText) {
        return result.responseText;
      }

      // No response and no next node — nothing more to do
      if (!result.nextNodeId) break;

      // Silent advance: loop to process the next node immediately
      // Only re-use the user's message for the first hop; subsequent hops use empty string
      text = '';
    }

    return '';
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async dispatch(
    node: FlowNode,
    config: FlowConfig,
    session: FlowSession,
    text: string,
    mediaBase64?: string,
    mediaMime?: string,
  ) {
    const edgesFromNode = config.edges.filter(e => e.source === node.id);
    const cfg = this.aiConfig;

    switch (node.type) {
      case 'start': {
        // Move immediately to first connected node
        const nextEdge = edgesFromNode[0];
        if (!nextEdge) return { responseText: 'Fluxo sem nós conectados.', nextNodeId: null };
        return { responseText: '', nextNodeId: nextEdge.target };
      }

      case 'triage':
        return handleTriage(node, edgesFromNode, session, text, cfg);

      case 'collect':
        return handleCollect(node, edgesFromNode, session, text, cfg);

      case 'situational':
        return handleSituational(node, edgesFromNode, session, text, cfg, this.erpUrl);

      case 'choice':
        return handleChoice(node, edgesFromNode, session, text, cfg);

      case 'vision':
        return handleVision(node, edgesFromNode, session, text, cfg, mediaBase64, mediaMime);

      case 'action':
        return handleAction(node, edgesFromNode, session, cfg, this.erpUrl);

      case 'end':
        return handleEnd(node);

      default:
        return { responseText: 'Nó desconhecido.', nextNodeId: null };
    }
  }

  private findStartNode(config: FlowConfig): FlowNode | undefined {
    return config.nodes.find(n => n.type === 'start');
  }

  private async loadFlowConfig(tenantId: number): Promise<FlowConfig | null> {
    if (this.inlineFlowConfig) return this.inlineFlowConfig;
    try {
      const res = await axios.get(`${this.erpUrl}/mcp/flow-config`, {
        headers: internalHeaders,
        params: { tenantId },
      });
      return res.data as FlowConfig;
    } catch (e: any) {
      console.error('[FLOW] Failed to load flow config:', e.message);
      return null;
    }
  }

  private async loadSession(tenantId: number, phone: string, config: FlowConfig): Promise<FlowSession> {
    // Check in-memory cache first
    const cached = getCachedSession(tenantId, phone);
    if (cached) return cached;

    // Try to load from DB
    try {
      const res = await axios.get(`${this.erpUrl}/mcp/flow-session/${tenantId}/${phone}`, {
        headers: internalHeaders,
      });
      if (res.data) {
        const rd = res.data as any;
        const session: FlowSession = {
          currentNodeId: rd.currentNodeId,
          collectedData: rd.collectedData || {},
          pendingChoice: rd.collectedData?._pendingChoice ?? null,
          pendingSituational: rd.collectedData?._pendingSituational ?? null,
        };
        setCachedSession(tenantId, phone, session);
        return session;
      }
    } catch {
      // 404 = no session yet, create fresh one
    }

    const startNode = this.findStartNode(config);
    const newSession: FlowSession = {
      currentNodeId: startNode?.id ?? '',
      collectedData: {},
    };
    return newSession;
  }

  private async saveSession(tenantId: number, phone: string, session: FlowSession): Promise<void> {
    // Store pending flags inside collectedData for DB persistence
    const collectedData = {
      ...session.collectedData,
      _pendingChoice: session.pendingChoice ?? null,
      _pendingSituational: session.pendingSituational ?? null,
    };

    setCachedSession(tenantId, phone, session);

    try {
      await axios.patch(
        `${this.erpUrl}/mcp/flow-session/${tenantId}/${phone}`,
        { currentNodeId: session.currentNodeId, collectedData },
        { headers: internalHeaders },
      );
    } catch (e: any) {
      console.error('[FLOW] Failed to save session:', e.message);
    }
  }

  private async deleteSession(tenantId: number, phone: string): Promise<void> {
    deleteCachedSession(tenantId, phone);
    try {
      await axios.delete(`${this.erpUrl}/mcp/flow-session/${tenantId}/${phone}`, {
        headers: internalHeaders,
      });
    } catch (e: any) {
      console.error('[FLOW] Failed to delete session:', e.message);
    }
  }
}
