import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { sendOtpEmail } from '../utils/email.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Send OTP to user email
// @route   POST /api/auth/send-otp
// @access  Public
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        // Generate a 6-digit OTP
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Check if OTP already exists for user and delete to prevent spam 
        await Otp.deleteMany({ email });

        // Save new OTP
        const newOtp = new Otp({ email, otp: generatedOtp });
        await newOtp.save();

        // Send OTP via email using nodemailer (uncomment to activate real email sending)
        // Note: For a real hackathon project, add real Gmail app passwords in .env
        console.log(`[DEV MODE] Generated OTP for ${email}: ${generatedOtp}`);

        try {
            await sendOtpEmail(email, generatedOtp);
        } catch (e) {
            console.log("Could not send real email. Fallback: Check console for OTP.");
        }

        res.status(200).json({ message: 'OTP sent successfully to email' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error sending OTP' });
    }
});

// @desc    Verify OTP and login/register user
// @route   POST /api/auth/verify-otp
// @access  Public
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    try {
        // Find the OTP in database
        const otpRecord = await Otp.findOne({ email });

        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Compare
        if (otpRecord.otp !== otp) {
            return res.status(400).json({ message: 'Incorrect OTP' });
        }

        // OTP is correct. Find if user exists, else create them.
        let user = await User.findOne({ email });
        let isNewUser = false;

        if (!user) {
            user = await User.create({ email });
            isNewUser = true;
        }

        // Auto-Promote to superadmin
        if (user.email === 'viveks3931@gmail.com' && user.role !== 'superadmin') {
            user.role = 'superadmin';
            await user.save();
        }

        // Delete the used OTP
        await Otp.deleteOne({ _id: otpRecord._id });

        res.status(200).json({
            message: 'Login successful',
            isNewUser: !user.name || !user.preference, // Need onboarding if missing core info
            token: generateToken(user._id),
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                preference: user.preference,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error verifying OTP' });
    }
});

// @desc    Complete profile after first OTP login
// @route   POST /api/auth/complete-profile
// @access  Private
router.post('/complete-profile', protect, async (req, res) => {
    const { name, preference } = req.body;

    if (!name || !preference) {
        return res.status(400).json({ message: 'Name and preference are required' });
    }

    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.name = name;
        user.preference = preference;
        await user.save();

        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                preference: user.preference,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error completing profile' });
    }
});

export default router;
