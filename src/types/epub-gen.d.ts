declare module 'epub-gen' {
    interface EpubOptions {
        title: string;
        author?: string;
        publisher?: string;
        cover?: string;
        content: Array<{
            title: string;
            data: string;
        }>;
    }

    class Epub {
        constructor(options: EpubOptions, output: string);
        promise: Promise<void>;
    }

    export = Epub;
}
