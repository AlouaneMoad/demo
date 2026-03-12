// sounds.js
const sounds = {
  add: new Audio('sound/add.mp3'),
  delete: new Audio('sound/delete.mp3'),
  complete: new Audio('sound/complet.mp3'),
  click: new Audio('sound/click.mp3')
};

function playSound(type) {
  if (sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play().catch(e => console.error('Sound play failed:', e));
  }
}
