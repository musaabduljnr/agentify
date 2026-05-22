const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log("Checking storage buckets...");
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error("Error listing buckets:", listError.message);
    return;
  }
  
  const bucketNames = buckets.map(b => b.name);
  console.log("Existing buckets:", bucketNames);
  
  if (!bucketNames.includes('business-documents')) {
    console.log("Creating 'business-documents' bucket...");
    const { data, error: createError } = await supabase.storage.createBucket('business-documents', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: [
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    });
    
    if (createError) {
      console.error("Error creating bucket:", createError.message);
    } else {
      console.log("Bucket 'business-documents' created successfully!", data);
    }
  } else {
    console.log("'business-documents' bucket already exists.");
  }
}

run();
