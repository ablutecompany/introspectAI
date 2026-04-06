const fs = require('fs');
const path = require('path');

function patch(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            patch(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            content = content.replace(/(from\s+['"])(\..*?)(['"])/g, (m, p1, p2, p3) => {
                if (p2.endsWith('.js') || p2.endsWith('.ts')) return m;
                return p1 + p2 + '.js' + p3;
            });
            fs.writeFileSync(fullPath, content);
        }
    });
}
patch('api');
patch('server');
