const debugGps = false;

const debug = (str) => {
    const msg = document.createElement('p');
    msg.innerHTML = str;
    document.querySelector('#debug').appendChild(msg);
}

let coord;
let screen;

debugGps && document.addEventListener('keydown', (e) => {

    const x1 = -71.514;
    const x2 = -71.513;
    const x3 = -71.512;
    const y1 = 42.936;
    const y2 = 42.937;
    const y3 = 42.938;

    switch (e.key) {
        case '1': plotPoint(100, 100, coord); break;
        case '2': plotPoint(100, 50, coord); break;

            42.9374444, -71.5138986
        case 'q': coord = { longitude: x1, latitude: y1, accuracy: 1 }; screen = { x: 100, y: 100 }; break;
        case 'w': coord = { longitude: x2, latitude: y1, accuracy: 1 }; screen = { x: 150, y: 100 }; break;
        case 'e': coord = { longitude: x3, latitude: y1, accuracy: 1 }; screen = { x: 200, y: 100 }; break;

        case 'a': coord = { longitude: x1, latitude: y2, accuracy: 1 }; screen = { x: 100, y: 150 }; break;
        case 's': coord = { longitude: x2, latitude: y2, accuracy: 1 }; screen = { x: 150, y: 150 }; break;
        case 'd': coord = { longitude: x3, latitude: y2, accuracy: 1 }; screen = { x: 200, y: 150 }; break;

        case 'z': coord = { longitude: x1, latitude: y3, accuracy: 1 }; screen = { x: 100, y: 200 }; break;
        case 'x': coord = { longitude: x2, latitude: y3, accuracy: 1 }; screen = { x: 150, y: 200 }; break;
        case 'c': coord = { longitude: x3, latitude: y3, accuracy: 1 }; screen = { x: 200, y: 200 }; break;

        case 'p': plotCurrentPosition(coord); break;
        case 'o':
            console.log(screen, coord);
            plotPoint(screen.x, screen.y, coord);
            break;
    }
});
