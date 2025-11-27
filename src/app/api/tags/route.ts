import { NextRequest, NextResponse } from 'next/server';
import { getTags, createTag } from '@/lib/db';

export async function GET() {
    try {
        const tags = getTags();
        return NextResponse.json(tags);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { name } = await request.json();
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        const tag = createTag(name);
        return NextResponse.json(tag, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }
}
