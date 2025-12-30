const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

try {
    const config = db.prepare('SELECT * FROM app_config WHERE id = 1').get();
    console.log('Current Config:', config);

    if (config) {
        db.prepare('UPDATE app_config SET admin_password = NULL WHERE id = 1').run();
        console.log('Admin password CLEARED. Setup screen should appear.');
    } else {
        console.log('No config found.');
    }
} catch (error) {
    console.error('Error:', error);
}
