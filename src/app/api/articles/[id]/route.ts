
import { NextRequest, NextResponse } from 'next/server';
import { deleteArticle, updateArticleList, addTagToArticle, removeTagFromArticle } from '@/lib/db';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        if (body.list_id) {
            updateArticleList(id, body.list_id);
        }

        if (body.addTag) {
            addTagToArticle(id, body.addTag);
        }

        if (body.removeTag) {
            removeTagFromArticle(id, body.removeTag);
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Error updating article:', error);
        return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        deleteArticle(id);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Error deleting article:', error);
        return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
    }
}
