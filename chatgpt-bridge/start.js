import app from './server.js';
app.listen(Number(process.env.PORT || 8080), '0.0.0.0');
