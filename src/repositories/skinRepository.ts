import fs from 'fs';
import path from 'path';
import { Skin } from '../models/Skin';

const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');

class SkinRepository {
    private getAllData(): { skins: Skin[] } {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    }

    public findAll(): Skin[] {
        return this.getAllData().skins;
    }

    public findById(id: number): Skin | undefined {
        return this.findAll().find(s => s.id === id);
    }
}

export default new SkinRepository();