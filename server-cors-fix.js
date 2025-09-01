// Updated CORS configuration for server.js
// Replace the cors middleware section with this:

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://pricemymeds.co.uk', 
        'https://www.pricemymeds.co.uk',
        'http://pricemymeds.co.uk',  // Add HTTP version
        'http://www.pricemymeds.co.uk' // Add HTTP version
      ]
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));