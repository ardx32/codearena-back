import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Problem from './models/Problem.js';
import connectDB from './config/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function seed() {
    await connectDB();

    // Load all batch files
    const batchFiles = [
        'data/problems_batch1.json',
        'data/problems_batch2.json',
        'data/problems_batch3.json',
        'data/problems_batch4.json',
    ];

    let allProblems = [];
    for (const file of batchFiles) {
        const raw = readFileSync(join(__dirname, file), 'utf-8');
        allProblems = allProblems.concat(JSON.parse(raw));
    }

    console.log(`📦 Loaded ${allProblems.length} problems from ${batchFiles.length} batch files.`);

    // Find the highest existing problemNumber to avoid conflicts
    const lastProblem = await Problem.findOne().sort({ problemNumber: -1 }).select('problemNumber');
    const startNumber = (lastProblem?.problemNumber || 0);

    // Filter out problems whose titles already exist to avoid duplicates
    const existingTitles = (await Problem.find({ isMock: true }).select('title')).map(p => p.title);
    const newProblems = allProblems.filter(p => !existingTitles.includes(p.title));

    if (newProblems.length === 0) {
        console.log('✅ All problems already exist in the database. Nothing to seed.');
        process.exit(0);
    }

    // Assign problemNumbers starting after the last existing one
    const toInsert = newProblems.map((p, i) => ({
        ...p,
        problemNumber: startNumber + i + 1,
        isMock: true,
    }));

    await Problem.insertMany(toInsert);
    console.log(`✅ Successfully seeded ${toInsert.length} new problems! (Total in DB: ${existingTitles.length + toInsert.length})`);
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
