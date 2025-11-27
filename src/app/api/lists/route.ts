import { NextRequest, NextResponse } from 'next/server';
import { getLists, createList } from '@/lib/db';

export async function GET() {
    try {
        const lists = getLists();
        return NextResponse.json(lists);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { name } = await request.json();
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        const list = createList(name);
        return NextResponse.json(list, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
    }
}
