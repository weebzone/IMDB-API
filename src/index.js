import express from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';

// Import route handlers
import search from './routes/search.js';
import title from './routes/title.js';
import reviews from './routes/reviews.js';
import indexRoute from './routes/index.js';
import userRoutes from './routes/user/index.js';

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: '*'
}));

app.use(express.json());

// Cache middleware
const cacheMiddleware = (req, res, next) => {
  if (req.method === 'GET' && process.env.CACHE_DISABLED !== 'true') {
    const cacheKey = req.originalUrl;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    // Store original res.json
    const originalJson = res.json;
    res.json = function(data) {
      // Cache successful responses
      if (res.statusCode === 200) {
        const ttl = getCacheTTL(req.originalUrl);
        cache.set(cacheKey, data, ttl);
      }
      return originalJson.call(this, data);
    };
  }
  next();
};

// Cache TTL logic
const getCacheTTL = (url) => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('/reviews')) return 86400; // 24 hours
  if (urlLower.includes('/title')) return 86400; // 24 hours
  if (urlLower.includes('/search')) return 172800; // 48 hours
  return 86400; // 24 hours default
};

app.use(cacheMiddleware);

// Route handlers with error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes
app.get('/', asyncHandler(async (req, res) => {
  const mockReq = { url: req.originalUrl };
  const result = await indexRoute(mockReq);
  const data = await result.json();
  res.json(data);
}));

app.get('/search', asyncHandler(async (req, res) => {
  const mockReq = { 
    url: req.protocol + '://' + req.get('host') + req.originalUrl 
  };
  const result = await search(mockReq);
  const data = await result.json();
  res.status(result.status).json(data);
}));

app.get('/title/:id', asyncHandler(async (req, res) => {
  const mockReq = { 
    params: req.params,
    url: req.protocol + '://' + req.get('host') + req.originalUrl 
  };
  const result = await title(mockReq);
  const data = await result.json();
  res.status(result.status).json(data);
}));

app.get('/title/:id/season/:seasonId', asyncHandler(async (req, res) => {
  const mockReq = { 
    params: req.params,
    url: req.protocol + '://' + req.get('host') + req.originalUrl 
  };
  const result = await title(mockReq);
  const data = await result.json();
  res.status(result.status).json(data);
}));

app.get('/reviews/:id', asyncHandler(async (req, res) => {
  const mockReq = { 
    url: req.protocol + '://' + req.get('host') + req.originalUrl 
  };
  const result = await reviews(mockReq, {}, {}, req.params);
  const data = await result.json();
  res.status(result.status).json(data);
}));

app.get('/user/:id', asyncHandler(async (req, res) => {
  const mockReq = { params: req.params };
  const result = await userRoutes.info(mockReq);
  const data = await result.json();
  res.status(result.status).json(data);
}));

app.get('/user/:id/ratings', asyncHandler(async (req, res) => {
  const mockReq = { params: req.params };
  const result = await userRoutes.ratings(mockReq);
  const data = await result.json();
  res.status(result.status).json(data);
}));

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled Error:', error);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: error.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`IMDb API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
