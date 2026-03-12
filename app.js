;(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyAEpxaNnta5-63fJft8vTj3Egu6eAeKodw",
    authDomain: "to-do-list-fe676.firebaseapp.com",
    projectId: "to-do-list-fe676",
    storageBucket: "to-do-list-fe676.firebasestorage.app",
    messagingSenderId: "47441929481",
    appId: "1:47441929481:web:0f7de76d7a5df601c8dfd8"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const els = {
    wrap: $('#wrap'),
    authView: $('#authView'),
    app: $('#app'),
    authForm: $('#authForm'),
    authEmail: $('#authEmail'),
    authPassword: $('#authPassword'),
    authHint: $('#authHint'),
    authSubmit: $('#authSubmit'),
    // authSubmitText: $('#authSubmitText'),
    authToggle: $('#authToggle'),
    signOutBtn: $('#signOutBtn'),
    list: $('#list'),
    template: $('#itemTemplate'),
    search: $('#search'),
    newTask: $('#newTask'),
    newTag: $('#newTag'),
    newDue: $('#newDue'),
    addBtn: $('#addBtn'),
    filterRadios: $$('input[name="filter"]'),
    count: $('#count'),
  };

  /** @type {Array<{id:string,title:string,done:boolean,tag?:string,due?:string,created:number,order:number}>} */
  let todos = [];
  const state = { filter: 'active', query: '', isSignUp: false };

  function uid() { return Math.random().toString(36).slice(2, 9); }

  function setAuthHint(msg, isError = false) {
    els.authHint.textContent = msg || '';
    els.authHint.classList.toggle('error', !!isError);
  }

  function showView(showAuth) {
    els.authView.style.display = showAuth ? 'grid' : 'none';
    els.app.style.display = showAuth ? 'none' : 'block';
    els.signOutBtn.style.display = showAuth ? 'none' : 'block';
  }

  function todosCollection() {
    const u = auth.currentUser;
    if (!u) return null;
    return db.collection('users').doc(u.uid).collection('todos');
  }

  async function load() {
    const col = todosCollection();
    if (!col) return [];
    try {
      const snap = await col.get();
      const arr = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, order: data.order ?? 0 };
      });
      return arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch (e) {
      console.error('Firestore load error', e);
      return [];
    }
  }

  async function saveTodo(t) {
    const col = todosCollection();
    if (!col) return;
    try {
      await col.doc(t.id).set({
        title: t.title,
        done: t.done,
        tag: t.tag || '',
        due: t.due || null,
        created: t.created,
        order: t.order
      });
    } catch (e) {
      console.error('Firestore save error', e);
    }
  }

  async function deleteTodo(id) {
    const col = todosCollection();
    if (!col) return;
    try {
      await col.doc(id).delete();
    } catch (e) {
      console.error('Firestore delete error', e);
    }
  }

  function prettyDate(iso) {
    const d = new Date(iso);
    const dUTC = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const today = new Date();
    const todayUTC = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const delta = (dUTC - todayUTC) / 86400000;
    if (delta === 0) return 'today';
    if (delta === 1) return 'tomorrow';
    if (delta === -1) return 'yesterday';
    const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
    return dUTC.toLocaleDateString(undefined, opts);
  }

  function render() {
    if (!els.list) return;
    els.list.innerHTML = '';
    els.filterRadios.forEach(input => { input.checked = input.value === state.filter; });
    const filtered = todos
      .filter(t => state.filter === 'all' || (state.filter === 'done' ? t.done : !t.done))
      .filter(t => {
        if (!state.query) return true;
        const q = state.query.toLowerCase();
        return t.title.toLowerCase().includes(q) || (t.tag || '').toLowerCase().includes(q);
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    els.count.textContent = filtered.length;

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = 'Nothing here yet. Add a task above, or try <strong>All / Active / Completed</strong> filters.';
      els.list.appendChild(empty);
      return;
    }

    for (const t of filtered) {
      const node = els.template.content.firstElementChild.cloneNode(true);
      node.dataset.id = t.id;

      const inputEl = node.querySelector('.task-check-input');
      const titleEl = node.querySelector('.task-title');

      inputEl.checked = t.done;
      titleEl.textContent = t.title;
      titleEl.dataset.text = t.title;

      node.querySelector('.tag').textContent = t.tag || '';
      node.querySelector('.due').textContent = t.due ? `Due ${prettyDate(t.due)}` : '';
      if (!t.tag) node.querySelector('.tag').style.display = 'none';
      if (!t.due) node.querySelector('.due').style.display = 'none';

      inputEl.addEventListener('change', () => toggle(t.id));

      titleEl.setAttribute('contenteditable', 'true');
      titleEl.setAttribute('spellcheck', 'false');
      titleEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
      });
      titleEl.addEventListener('blur', () => {
        const newTitle = titleEl.textContent.trim();
        titleEl.dataset.text = newTitle;
        edit(t.id, { title: newTitle });
      });

      node.querySelector('[data-action="delete"]').addEventListener('click', () => remove(t.id));
      node.querySelector('[data-action="edit"]').addEventListener('click', () => {
        titleEl.focus();
        document.execCommand('selectAll', false, null);
        document.getSelection().collapseToEnd();
      });

      node.addEventListener('dragstart', dragStart);
      node.addEventListener('dragend', dragEnd);
      node.addEventListener('dragover', dragOver);

      els.list.appendChild(node);
    }
  }

  async function add() {
    const title = els.newTask.value.trim();
    if (!title) return;
    const t = {
      id: uid(),
      title,
      done: false,
      tag: (els.newTag.value.trim() || '').replace(/\s+/g, '').replace(/#+/, '#'),
      due: els.newDue.value || undefined,
      created: Date.now(),
      order: todos.length ? Math.max(...todos.map(x => x.order || 0)) + 1 : 0,
    };
    todos.push(t);
    await saveTodo(t);
    els.newTask.value = ''; els.newTag.value = ''; els.newDue.value = '';
    render();
  }

  async function toggle(id) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    await saveTodo(t);
    render();
  }

  async function edit(id, patch) {
    const i = todos.findIndex(x => x.id === id);
    if (i < 0) return;
    if (patch.title === '') {
      render();
      return;
    }
    todos[i] = { ...todos[i], ...patch };
    await saveTodo(todos[i]);
    render();
  }

  async function remove(id) {
    todos = todos.filter(x => x.id !== id);
    await deleteTodo(id);
    render();
  }

  let dragId = null;
  function dragStart(e) {
    dragId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
  async function dragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    dragId = null;
    await Promise.all(todos.map(t => saveTodo(t)));
    render();
  }
  async function dragOver(e) {
    e.preventDefault();
    const over = e.currentTarget;
    if (!dragId || over.dataset.id === dragId) return;
    const a = todos.find(t => t.id === dragId);
    const b = todos.find(t => t.id === over.dataset.id);
    if (!a || !b) return;
    const ao = a.order ?? 0, bo = b.order ?? 0;
    a.order = bo;
    b.order = ao;
    await saveTodo(a);
    await saveTodo(b);
    render();
  }

  // --- Auth ---
  els.authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    if (!email || !password) {
      setAuthHint('Please enter email and password.', true);
      return;
    }
    setAuthHint('Signing in…');
    els.authSubmit.disabled = true;
    try {
      if (state.isSignUp) {
        await auth.createUserWithEmailAndPassword(email, password);
        setAuthHint('Account created. Welcome!');
      } else {
        await auth.signInWithEmailAndPassword(email, password);
        setAuthHint('');
      }
    } catch (err) {
      setAuthHint(err.message || 'Authentication failed.', true);
    }
    els.authSubmit.disabled = false;
  });

  els.authToggle.addEventListener('click', () => {
    state.isSignUp = !state.isSignUp;
    els.authSubmit.textContent = state.isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN';
    els.authToggle.textContent = state.isSignUp ? 'Already have an account?' : 'Create account';
    setAuthHint('');
  });

  els.signOutBtn.addEventListener('click', () => auth.signOut());

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      showView(false);
      todos = await load();
      render();
      const footerNote = $('.footer div:last-child');
      if (footerNote) {
        footerNote.textContent = 'Synced with Firestore';
      }
    } else {
      showView(true);
      todos = [];
    }
  });

  // App controls (bound once; only take effect when logged in)
  els.filterRadios.forEach(input => input.addEventListener('change', () => {
    if (!input.checked) return;
    state.filter = input.value;
    render();
  }));
  els.search.addEventListener('input', () => { state.query = els.search.value.trim(); render(); });
  els.addBtn.addEventListener('click', add);
  els.newTask.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });

  // Keyboard shortcut (global)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      try { alert('Shortcuts:\n/ focus search\nEnter add task\nDrag to reorder\nEsc blur edits'); } catch (_) {}
    }
    if (e.key === '/' && document.activeElement !== els.search && document.body.contains(els.search) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
      e.preventDefault();
      els.search?.focus();
    }
  });

  // Initial view: show auth until Firebase reports state
  showView(true);
})();
