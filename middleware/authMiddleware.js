const jwt = require('jsonwebtoken');
// Yeh hamara middleware function hai
const protect = (req, res, next) => {
    try {
        // 1. Frontend token ko headers mein bhejta hai (format: "Bearer eyJhbGci...")
        // Hum yahan check kar rahe hain ke kya header mein token mojood hai?
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            // 'Bearer ' ko hata kar sirf asli token nikal rahe hain
            token = req.headers.authorization.split(' ')[1];
        }
        // 2. Agar token bilkul hi nahi bheja gaya
        if (!token) {
            return res.status(401).json({ message: "Not authorized, no token provided" });
        }
        // 3. Token ko verify karein (apne secret password ke sath)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // 4. Sabse zaroori step: Decoded data (jisme userId aur role chupa tha) 
        // usko hum 'req.user' mein daal dete hain taake aage route mein use ho sake.
        req.user = decoded;
        // 5. Guard ne check kar liya sab theek hai, ab aage jane do!
        next(); 
    } catch (error) {
        // Agar token expire ho gaya ho ya fake ho
        console.error("Token Verification Error:", error.message);
        res.status(401).json({ message: "Not authorized, invalid token" });
    }
};
module.exports = { protect };