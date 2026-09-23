const express = require("express");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const path = require("path");

// Load service account key from Render's secure directory
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();
const app = express();

// Fetch credentials securely from environment variables
const SENDER_EMAIL = process.env.GMAIL_USER; 
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASS;

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: SENDER_EMAIL,
        pass: GMAIL_APP_PASSWORD
    }
});

// Endpoint triggered every minute by Cron-Job.org
app.get("/check-tasks", async (req, res) => {
    const now = admin.firestore.Timestamp.now();

    try {
        const snapshot = await db.collection("tasks")
            .where("alert1Sent", "==", false)
            .where("alert1Time", "<=", now)
            .get();

        if (snapshot.empty) {
            return res.send("No tasks due at this time.");
        }

        for (const doc of snapshot.docs) {
            const task = doc.data();

            if (task.contact && task.contact.includes("@")) {
                const recipientEmail = task.contact.trim();

                const mailOptions = {
                    from: `"Just Do It App" <${SENDER_EMAIL}>`,
                    to: recipientEmail,
                    subject: `⏰ Task Reminder: ${task.task}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #062e3f; border-radius: 12px; max-width: 500px;">
                            <h2 style="color: #062e3f; margin-top: 0;">⏰ Task Reminder!</h2>
                            <p style="font-size: 16px;">Hello! You scheduled a task on your To-Do App:</p>
                            <div style="background-color: #f4f4f4; padding: 15px; border-left: 5px solid #062e3f; font-size: 18px; font-weight: bold; margin: 15px 0;">
                                ${task.task}
                            </div>
                            <p style="font-size: 14px; color: #555;">
                                <strong>Date:</strong> ${task.date || 'Today'} | <strong>Time:</strong> ${task.time || 'Scheduled Time'}
                            </p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log(`Email sent successfully to ${recipientEmail}`);
            }

            // Mark alert as sent
            await db.collection("tasks").doc(doc.id).update({ alert1Sent: true });
        }

        res.send("Tasks processed successfully.");
    } catch (error) {
        console.error("Error processing tasks:", error);
        res.status(500).send(error.message);
    }
});

app.get("/", (req, res) => {
    res.send("To-Do Backend Server is Running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));