const express = require('express');
const nodemailer = require('nodemailer');

function sendEmail(text, targetEmail) {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'rasheed3086@gmail.com',
            pass: 'wqdv muzp rfke mdou'
        },
    });

    return transporter.sendMail({
        to: targetEmail,
        subject: 'Your Receptionist Assistant is ready!',
        html: `<p>Your Receptionist Assistant is ready to assist you. You can access it at on this number:${text}</p>`,
    });
}

module.exports = sendEmail;
