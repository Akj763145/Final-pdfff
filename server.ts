import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer setup (memory storage for Supabase upload)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Admin Auth
const ADMIN_PASSWORD = '7673085672';
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${ADMIN_PASSWORD}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// API Routes
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/pdfs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pdfs')
      .select('*')
      .order('upload_date', { ascending: false });

    if (error) throw error;
    res.json(data.map((p: any) => ({
      id: p.id,
      filename: p.filename,
      uploadDate: p.upload_date,
      size: p.size,
      genre: p.genre,
      isLink: p.is_link,
      url: p.url
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/upload', requireAdmin, upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const genre = req.body.genre || 'General';
  const filename = req.file.originalname;
  const storagePath = `${uuidv4()}-${filename}`;

  try {
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(storagePath, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('pdfs')
      .getPublicUrl(storagePath);

    // Save to Database
    const { data, error: dbError } = await supabase
      .from('pdfs')
      .insert([
        {
          id: uuidv4(),
          filename,
          storage_path: storagePath,
          size: req.file.size,
          upload_date: new Date().toISOString(),
          genre,
          is_link: false,
          url: publicUrl
        }
      ])
      .select();

    if (dbError) throw dbError;

    res.json({ message: 'File uploaded successfully', pdf: data[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/link', requireAdmin, async (req, res) => {
  const { filename, url, genre } = req.body;
  if (!filename || !url) {
    return res.status(400).json({ error: 'Filename and URL are required' });
  }

  try {
    const { data, error } = await supabase
      .from('pdfs')
      .insert([
        {
          id: uuidv4(),
          filename,
          storage_path: 'external-link',
          size: 0,
          upload_date: new Date().toISOString(),
          genre: genre || 'General',
          is_link: true,
          url
        }
      ])
      .select();

    if (error) throw error;
    res.json({ message: 'Link added successfully', pdf: data[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/pdfs/:id', requireAdmin, async (req, res) => {
  try {
    const { data: pdf, error: fetchError } = await supabase
      .from('pdfs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;

    if (pdf && !pdf.is_link) {
      const { error: deleteStorageError } = await supabase.storage
        .from('pdfs')
        .remove([pdf.storage_path]);
      if (deleteStorageError) throw deleteStorageError;
    }

    const { error: deleteDbError } = await supabase
      .from('pdfs')
      .delete()
      .eq('id', req.params.id);

    if (deleteDbError) throw deleteDbError;

    res.json({ message: 'PDF deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
