import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Transporter configuration based on user credentials
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to another provider if needed
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendOtpEmail = async (email, otp) => {
    const mailOptions = {
        from: `"CodeArena Login" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your CodeArena Secure Login OTP',
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #120a06; color: #ffffff; padding: 40px; border-radius: 10px; max-width: 500px; margin: auto; border: 1px solid #2d1e16;">
                <h2 style="color: #f66b15; margin-bottom: 20px;">Welcome to CodeArena</h2>
                <p style="font-size: 16px; color: #d1d5db;">You requested to securely log in. Here is your One-Time Password:</p>
                <div style="background-color: #2a1a10; padding: 15px 25px; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #f66b15; text-align: center; margin: 30px 0; border: 1px solid #4a2311;">
                    ${otp}
                </div>
                <p style="font-size: 14px; color: #9ca3af;">This code will expire in 5 minutes. DO NOT share this code with anyone.</p>
                <p style="font-size: 12px; color: #6b7280; margin-top: 40px; border-top: 1px solid #2d1e16; padding-top: 15px;">If you did not request this email, you can safely ignore it.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP Email sent to ${email}`);
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error('Could not send OTP email. Please check your config.');
    }
};
