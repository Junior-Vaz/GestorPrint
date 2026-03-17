async function seed() {
  const products = [
    { name: 'Couchê 300g', type: 'PAPER', unitPrice: 45.0, description: 'Papel padrão para cartões e capas' },
    { name: 'Sulfite 75g', type: 'PAPER', unitPrice: 12.0, description: 'Papel comum para formulários' },
    { name: 'Offset 90g', type: 'PAPER', unitPrice: 18.0, description: 'Papel branco para timbrados' },
    { name: 'Couchê 150g', type: 'PAPER', unitPrice: 30.0, description: 'Papel para panfletos e folders' },
    { name: 'Laminado Fosco', type: 'FINISHING', unitPrice: 0.15, description: 'Plastificação fosca por unidade' },
    { name: 'Verniz Localizado', type: 'FINISHING', unitPrice: 0.25, description: 'Brilho em pontos específicos' },
    { name: 'Dobra', type: 'FINISHING', unitPrice: 0.05, description: 'Vinco e dobra simples' },
    { name: 'Corte Especial', type: 'FINISHING', unitPrice: 0.40, description: 'Faca de corte personalizada' },
  ];

  for (const p of products) {
    try {
      await fetch('http://localhost:3000/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
      console.log(`Created product: ${p.name}`);
    } catch (e) {
      console.error(`Failed to create ${p.name}`);
    }
  }

  const customers = [
    { name: 'Gráfica Express', email: 'contato@graficaexpress.com', phone: '(11) 4444-4444', document: '12.345.678/0001-99' },
    { name: 'Agência Alpha', email: 'alpha@agencia.com', phone: '(11) 5555-5555', document: '98.765.432/0001-11' },
  ];

  for (const c of customers) {
    try {
      await fetch('http://localhost:3000/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c)
      });
      console.log(`Created customer: ${c.name}`);
    } catch (e) {
      console.error(`Failed to create ${c.name}`);
    }
  }
}

seed();
