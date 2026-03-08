import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DatabaseTable {
  name: string;
  columns: { name: string; type: string; nullable?: boolean; primary_key?: boolean }[];
}

function mapSqlTypeToFirestoreType(sqlType: string): string {
  const lower = sqlType.toLowerCase();
  if (lower.includes('int') || lower.includes('float') || lower.includes('numeric') || lower.includes('decimal')) return 'number';
  if (lower.includes('bool')) return 'boolean';
  if (lower.includes('timestamp') || lower.includes('date')) return 'timestamp';
  if (lower.includes('json')) return 'map';
  if (lower.includes('uuid')) return 'string';
  return 'string';
}

function generateFirestoreRules(tables: DatabaseTable[]): string {
  let rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
`;
  for (const table of tables) {
    rules += `
    // Collection: ${table.name}
    match /${table.name}/{documentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }
`;
  }
  rules += `  }
}`;
  return rules;
}

function generateFirestoreIndexes(tables: DatabaseTable[]): object {
  const indexes: { collectionGroup: string; queryScope: string; fields: { fieldPath: string; order: string }[] }[] = [];
  for (const table of tables) {
    const nonPkCols = table.columns.filter(c => !c.primary_key).slice(0, 2);
    if (nonPkCols.length >= 2) {
      indexes.push({
        collectionGroup: table.name,
        queryScope: 'COLLECTION',
        fields: nonPkCols.map(c => ({ fieldPath: c.name, order: 'ASCENDING' })),
      });
    }
  }
  return {
    indexes,
    fieldOverrides: [],
  };
}

function generateCollectionStructure(tables: DatabaseTable[]): Record<string, object> {
  const structure: Record<string, object> = {};
  for (const table of tables) {
    const doc: Record<string, string> = {};
    for (const col of table.columns) {
      if (col.primary_key) continue;
      doc[col.name] = mapSqlTypeToFirestoreType(col.type);
    }
    structure[table.name] = { exampleDocument: doc };
  }
  return structure;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tables, firebaseProjectId } = await req.json();

    if (!firebaseProjectId) {
      throw new Error('Firebase Project ID is required');
    }
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      throw new Error('No tables provided');
    }

    const firestoreRules = generateFirestoreRules(tables);
    const firestoreIndexes = generateFirestoreIndexes(tables);
    const collectionStructure = generateCollectionStructure(tables);

    return new Response(JSON.stringify({
      firestoreRules,
      firestoreIndexes,
      collectionStructure,
      instructions: `1. Save the rules as firestore.rules in your Firebase project root.\n2. Save the indexes as firestore.indexes.json.\n3. Run: firebase deploy --only firestore:rules,firestore:indexes\n4. Use the collection structure as a reference for your Firestore collections.`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('apply-firebase error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
