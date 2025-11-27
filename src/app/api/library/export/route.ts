import { NextResponse } from 'next/server';
import { exportLibrary } from '@/lib/db';

export async function GET() {
    try {
        const data = exportLibrary();
        return new NextResponse(JSON.stringify(data, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="reader_library_export_${new Date().toISOString().split('T')[0]}.json"`,
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to export library' }, { status: 500 });
    }
}
