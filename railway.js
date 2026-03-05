const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('🚀 RAILWAY SERVER IS WORKING!');
});

app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'API test working' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('✅ SERVER STARTED ON PORT', PORT);
});