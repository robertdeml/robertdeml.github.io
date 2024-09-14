const debug = (str) => {
    const msg = document.createElement('p');
    msg.innerHTML = str;
    document.querySelector('#debug').appendChild(msg);
}