import 'dotenv/config';
import mongoose from 'mongoose';
import { Request } from './modules/request/request.model.js';
import { User } from './modules/auth/auth.model.js';
import { Program } from './modules/program/program.model.js';
import { env } from './config/env.js';

async function seed() {
    try {
        console.log('Connecting to:', env.MONGO_URI);
        await mongoose.connect(env.MONGO_URI);
        console.log('Connected.');

        // 1. Get a user
        const user = await User.findOne({ email: 'admin@example.com' });
        if (!user) {
            console.error('Admin user not found. Please run seedAdmin first.');
            return;
        }

        // 2. Get or create a program
        let program = await Program.findOne({});
        if (!program) {
            console.log('Creating a test program...');
            program = await Program.create({
                name: 'Test Notification Program',
                description: 'Program for testing due date notifications',
                createdBy: user._id,
                status: 'active',
                settings: {
                    allowClientSubmission: true,
                    requireApproval: true
                },
                dueDateConfig: {
                    enabled: true,
                    defaultOffsetDays: 7
                }
            });
        }

        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const in12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);

        // 3. Create Overdue Request (submitted)
        await Request.create({
            programId: program._id,
            title: 'Test Overdue Request',
            description: 'This request is overdue.',
            status: 'submitted',
            createdBy: user._id,
            assignedTo: user._id,
            priority: 'high',
            dueDate: yesterday,
            fields: new Map()
        });

        // 4. Create Upcoming Request (draft)
        await Request.create({
            programId: program._id,
            title: 'Test Upcoming Request',
            description: 'This request is due in 12 hours.',
            status: 'draft',
            createdBy: user._id,
            assignedTo: user._id,
            priority: 'medium',
            dueDate: in12h,
            fields: new Map()
        });

        console.log('Seed completed successfully.');
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

seed();
