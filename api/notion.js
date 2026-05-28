export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_ID = process.env.NOTION_DB_ID;
  const TOKEN = process.env.NOTION_TOKEN;

  if (!DB_ID || !TOKEN) {
    return res.status(500).json({ error: 'Variables manquantes' });
  }

  if (req.method === 'GET') {
    const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ page_size: 100, sorts: [{ property: 'date', direction: 'ascending' }] })
    });
    return res.status(200).json(await r.json());
  }

  if (req.method === 'POST') {
    const body = req.body;

    if (body.newChantier) {
      const r = await fetch(`https://api.notion.com/v1/pages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent: { database_id: DB_ID },
          properties: {
            'Nom client': { title: [{ text: { content: body.client || '' } }] },
            'téléphone': { phone_number: body.telephone || '' },
            'type de chantier': { select: { name: body.typeChantier || 'Autre' } },
            'adresse': { rich_text: [{ text: { content: body.adresse || '' } }] },
            'description': { rich_text: [{ text: { content: body.description || '' } }] },
            'date': body.date ? { date: { start: body.date } } : undefined,
            'heure': { rich_text: [{ text: { content: body.heure || '' } }] },
            'Prix': { number: body.prixEstime || 0 },
            'Statut': { status: { name: 'Planifié' } }
          }
        })
      });
      return res.status(200).json(await r.json());
    }

    if (body.pageId) {
      const r = await fetch(`https://api.notion.com/v1/pages/${body.pageId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { 'Statut': { status: { name: 'Payé' } } } })
      });
      return res.status(200).json(await r.json());
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
