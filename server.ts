import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Supabase setup
const getSupabase = () => {
  const url = process.env.SUPABASE_URL;
  // Use service role key if available to bypass RLS for admin operations
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.');
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Multer setup (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf files are allowed'));
    }
  }
});

// Admin Auth Middleware
const ADMIN_PASSWORD = '7673085672'; // Hardcoded password
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

// --- FOLDERS API ---
app.get('/api/folders', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('folders').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Fetch folders error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

app.post('/api/admin/folders', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Folder name required' });
    
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('folders')
      .insert([{ name }])
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

app.delete('/api/admin/folders/:id', requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // 1. Get all PDFs in this folder to delete from storage
    const { data: pdfs, error: fetchError } = await supabase
      .from('pdfs')
      .select('storage_path')
      .eq('folder_id', req.params.id);
      
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Fetch PDFs error:", fetchError);
    }

    // 2. Delete files from Storage
    if (pdfs && pdfs.length > 0) {
      const paths = pdfs.map(p => p.storage_path).filter(Boolean);
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from('pdfs').remove(paths);
        if (storageError) console.error("Storage delete error:", storageError);
      }
    }

    // 3. Delete folder from Database (Cascade will delete PDF rows)
    const { error: dbError } = await supabase
      .from('folders')
      .delete()
      .eq('id', req.params.id);
      
    if (dbError) throw dbError;

    res.json({ message: 'Folder deleted successfully' });
  } catch (error: any) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// --- PDFS API ---
app.get('/api/pdfs', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pdfs')
      .select('*')
      .order('upload_date', { ascending: false });

    if (error) throw error;

    const clientPdfs = data.map((p: any) => {
      let linkUrl = p.storage_path;
      if (p.size === 0 && linkUrl && !linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
        linkUrl = 'https://' + linkUrl;
      }
      return {
        id: p.id,
        filename: p.filename,
        uploadDate: p.upload_date,
        size: p.size,
        folderId: p.folder_id,
        isLink: p.size === 0,
        link: p.size === 0 ? linkUrl : null
      };
    });
    
    res.json(clientPdfs);
  } catch (error: any) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

app.post('/api/admin/upload-link', requireAdmin, async (req, res) => {
  try {
    const { filename, link, folderId } = req.body;
    if (!filename || !link) return res.status(400).json({ error: 'Filename and link are required' });

    let formattedLink = link.trim();
    if (!formattedLink.startsWith('http://') && !formattedLink.startsWith('https://')) {
      formattedLink = 'https://' + formattedLink;
    }

    const supabase = getSupabase();
    const newPdf = {
      id: uuidv4(),
      filename: filename,
      storage_path: formattedLink,
      size: 0,
      upload_date: new Date().toISOString(),
      folder_id: folderId || null
    };

    const { error: dbError } = await supabase
      .from('pdfs')
      .insert([newPdf]);

    if (dbError) throw dbError;

    res.json({ 
      message: 'Link added successfully', 
      pdf: {
        id: newPdf.id,
        filename: newPdf.filename,
        uploadDate: newPdf.upload_date,
        size: newPdf.size,
        folderId: newPdf.folder_id,
        isLink: true,
        link: newPdf.storage_path
      }
    });
  } catch (error: any) {
    console.error('Upload link error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const supabase = getSupabase();
      const folderId = req.body.folderId || null;
      
      // Sanitize filename for storage
      const safeOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueName = `${uuidv4()}-${safeOriginalName}`;

      // 1. Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('pdfs')
        .upload(uniqueName, req.file.buffer, {
          contentType: 'application/pdf',
        });

      if (storageError) throw storageError;

      // 2. Insert metadata into Supabase Database
      const newPdf = {
        id: uuidv4(),
        filename: req.file.originalname,
        storage_path: uniqueName,
        size: req.file.size,
        upload_date: new Date().toISOString(),
        folder_id: folderId
      };

      const { error: dbError } = await supabase
        .from('pdfs')
        .insert([newPdf]);

      if (dbError) {
        // Rollback storage upload if DB insert fails
        await supabase.storage.from('pdfs').remove([uniqueName]);
        throw dbError;
      }

      res.json({ 
        message: 'File uploaded successfully', 
        pdf: {
          id: newPdf.id,
          filename: newPdf.filename,
          uploadDate: newPdf.upload_date,
          size: newPdf.size,
          folderId: newPdf.folder_id
        }
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message || 'Server error' });
    }
  });
});

app.delete('/api/admin/pdfs/:id', requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // 1. Get the storage path and size
    const { data: pdf, error: fetchError } = await supabase
      .from('pdfs')
      .select('storage_path, size')
      .eq('id', req.params.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // 2. Delete from Storage (only if it's not an external link)
    if (pdf && pdf.storage_path && pdf.size !== 0) {
      const { error: storageError } = await supabase.storage
        .from('pdfs')
        .remove([pdf.storage_path]);
      if (storageError) console.error('Storage delete error:', storageError);
    }

    // 3. Delete from Database
    const { error: dbError } = await supabase
      .from('pdfs')
      .delete()
      .eq('id', req.params.id);

    if (dbError) throw dbError;

    res.json({ message: 'PDF deleted successfully' });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

app.get('/api/pdfs/:id/download', async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // 1. Get PDF metadata
    const { data: pdf, error: fetchError } = await supabase
      .from('pdfs')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError || !pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // 2. Download file buffer from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(pdf.storage_path);

    if (downloadError || !fileData) {
      throw downloadError || new Error('File data not found');
    }

    // 3. Send file to client
    const buffer = Buffer.from(await fileData.arrayBuffer());
    
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Type', 'application/pdf');
    const encodedName = encodeURIComponent(pdf.filename);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    
    res.send(buffer);
  } catch (error: any) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Server error' });
    }
  }
});

app.get('/api/pdfs/:id/view', async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // 1. Get PDF metadata
    const { data: pdf, error: fetchError } = await supabase
      .from('pdfs')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError || !pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // 2. Download file buffer from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(pdf.storage_path);

    if (downloadError || !fileData) {
      throw downloadError || new Error('File data not found');
    }

    // 3. Send file to client
    const buffer = Buffer.from(await fileData.arrayBuffer());
    
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Type', 'application/pdf');
    const encodedName = encodeURIComponent(pdf.filename);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
    
    res.send(buffer);
  } catch (error: any) {
    console.error('View error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Server error' });
    }
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
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
