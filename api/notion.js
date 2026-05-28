export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_ID = process.env.NOTION_DB_ID;
  const TOKEN = process.env.NOTION_TOKEN;

  if (!DB_ID || !TOKEN) {
    return res.status(500).json({ error: 'Variables NOTION_TOKEN et NOTION_DB_ID manquantes dans Vercel' });
  }

  // GET — lire tous les chantiers
  if (req.method === 'GET') {
    const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page_size: 100,
        sorts: [{ property: 'date', direction: 'ascending' }]
      })
    });
    const data = await r.json();
    return res.status(200).json(data);
  }

  // POST — marquer comme PAYÉ
  if (req.method === 'POST') {
    const { pageId } = req.body;
    if (!pageId) return res.status(400).json({ error: 'pageId manquant' });
    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          Statut: { select: { name: 'Payé' } }
        }
      })
    });
    const data = await r.json();
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
