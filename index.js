import { readFile } from 'fs/promises';
import { generator, lexer, parser } from './utils.js';

const index = async () => {
    const data = await readFile('./code.bas');

    generator(parser(lexer(data.toString())))
}

index()