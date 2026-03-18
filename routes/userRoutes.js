const express = require('express');
const router = express.Router(); // Express ka router object call kiya
const bcrypt = require('bcrypt'); // Password hash karne ke liye
const User = require('../models/user'); // Hamara User schema jo humne banaya tha
const jwt = require('jsonwebtoken');
// Route:   POST /api/users/register
// Desc:    Register a new member or admin
// Access:  Public
router.post('/register', async (req, res) => {
    try {
        // 1. Frontend se aane wala data 'req.body' se nikalna (Destructuring)
        const { name, email, password, role } = req.body;

        // 2. Validation: Check karein ke email pehle se database mein toh nahi hai
        let userExists = await User.findOne({ email: email });
        if (userExists) {
            // Agar email mili, toh error response bhej dein
            return res.status(400).json({ message: "User already exists with this email" });
        }

        // 3. Security: Password ko plain text mein save NAHI karna. Isey hash karein.
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Naya User object create karein (using our Mongoose Model)
        const newUser = new User({
            name: name,
            email: email,
            password: hashedPassword,
            role: role || 'member' // Agar role nahi bheja, toh default 'member' rakho
        });

        // 5. Database mein permanently save kar dein
        await newUser.save();

        // 6. Frontend ko success message response (res) mein bhej dein
        res.status(201).json({
            message: "User registered successfully!",
            user: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (error) {
        // Agar server mein koi code phat jaye, toh app crash hone ke bajaye error response bheje
        console.error("Registration Error: ", error);
        res.status(500).json({ message: "Server Error during registration" });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;   
        // 1. Check karein ke user email se database mein hai ya nahi
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }
        // 2. Agar user mila, toh password match karta hai ya nahi, bcrypt se compare karein
        const isMatch = await bcrypt.compare(password, user.password);  
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }       
        const token = jwt.sign(
            { userId: user._id, role: user.role }, // Payload: Hum ID aur Role token ke andar chupa rahe hain
            process.env.JWT_SECRET,                // Secret Key: Jo humne .env mein rakhi thi
            { expiresIn: '7d' }                    // Expiry: Yeh token 7 din tak valid rahega
        );
        // 3. Agar email aur password dono sahi hain, toh success response bhej dein
        res.status(200).json({
            message: "Login successful!",  
            token: token, // Frontend ko JWT token bhej rahe hain 
            user: {
                _id: user._id,
                name: user.name,        
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login Error: ", error);
        res.status(500).json({ message: "Server Error during login" });
    }
});
// Is router ko export karna zaroori hai taake main server.js mein use ho sake
module.exports = router;