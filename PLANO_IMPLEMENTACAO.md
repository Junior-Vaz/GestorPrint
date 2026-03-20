# 🚀 PLANO DE IMPLEMENTAÇÃO - GestorPrint

**Status**: Em desenvolvimento (sem produção)
**Objetivo**: Preparar para SaaS + Segurança + Features gráfica

---

## 📋 ROADMAP - ORDEM DE IMPLEMENTAÇÃO

### **FASE 0: Preparação SaaS (2 horas)**
_Estrutura base para multi-tenant - FAÇA PRIMEIRO_

- [ ] Adicionar `tenantId` a todos 16 models Prisma
- [ ] Criar model `Tenant`
- [ ] Adicionar middleware de tenant auth
- [ ] Criar helper de tenant filter

**Por quê começar aqui?**
- Zero impacto no código existente
- Depois fica trivial refatorar queries
- 2h agora = 20h economizadas depois

---

### **FASE 1: Segurança MVP (3-4 horas)**
_Deixar production-ready_

- [ ] Add DTO validation (class-validator)
- [ ] Add backend route guards (@Roles)
- [ ] File upload security (tipos + size)
- [ ] Email notification triggers

**Impacto**: Previne bugs + vulnerabilidades

---

### **FASE 2: Upload Gráfica (1 hora)**
_Aceitar todos formatos (.cdr, .svg, .psd, etc)_

- [ ] Remove whitelist MIME types
- [ ] Accept all file extensions
- [ ] Validate only size (100MB max)
- [ ] Test com arquivo .cdr

---

### **FASE 3: Dashboard & Reports (3-4 horas)**
_Melhorar visualizações_

- [ ] Implementar gráficos ReportsView
- [ ] Add filters por período
- [ ] Margem por pedido
- [ ] Top 10 produtos

---

## 📍 ARQUIVOS QUE VÃO MUDAR

### Arquivos Críticos (Ordem de modificação):

1. **backend/prisma/schema.prisma** - Add tenantId (FASE 0)
2. **backend/src/auth/auth.service.ts** - Injeta tenantId no JWT (FASE 0)
3. **backend/src/tenant/tenant.middleware.ts** - Novo middleware (FASE 0)
4. **backend/src/common/decorators/tenant.decorator.ts** - Novo decorator (FASE 0)
5. **backend/src/**/**/**.dto.ts** - Add validation (FASE 1)
6. **backend/src/**/**/**.controller.ts** - Add @UseGuards (FASE 1)
7. **backend/src/files/files.service.ts** - Remove whitelist (FASE 2)
8. **frontend/src/views/ReportsView.vue** - Add charts (FASE 3)

---

## 🎯 POR ONDE COMEÇAR?

**Escolha uma opção:**

### OPÇÃO A: "Rápido & Seguro" (Recomendado)
```
1. FASE 0 (2h) - SaaS prep
2. FASE 1 (4h) - Segurança
3. FASE 2 (1h) - Upload
Total: 7h → Sistema pronto para produção single-tenant
```

### OPÇÃO B: "Só Upload Agora"
```
1. FASE 2 (1h) - Upload gráfica
Total: 1h → Tema resolvido
```

### OPÇÃO C: "Tudo de Uma Vez"
```
1. FASE 0 + 1 + 2 + 3
Total: ~10-11h → MVP 100% seguro + SaaS ready
```

---

## 💡 RECOMENDAÇÃO

**Começar com FASE 0 (SaaS Prep)** porque:
✅ Rápido (2 horas)
✅ Zero impacto no código existente
✅ Economiza 20 horas depois
✅ Depois refatorar queries é trivial

Depois FASE 1 (Segurança) porque:
✅ Impedi vulnerabilidades
✅ Deixa code quality alta
✅ Pronto para mostrar cliente

---

## 📞 Próximo Passo

Confirma por qual quer começar:

1. **FASE 0** - SaaS prep (começar agora)
2. **FASE 1** - Segurança
3. **FASE 2** - Upload gráfica
4. **Todas** - Implementar tudo

Vou criar código ready-to-implement para cada uma.
