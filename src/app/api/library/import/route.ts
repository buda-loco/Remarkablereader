import { NextRequest, NextResponse } from 'next/server';
import { importLibrary } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        importLibrary(data);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ error: 'Failed to import library' }, { status: 500 });
    }
}
