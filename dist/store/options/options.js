const $ = (id) => document.getElementById(id);
const DEFAULTS = { omdbKey: '', minRating: 7, minVotes: 10000, ottEnabled: true };

function status(msg) {
  $('status').textContent = msg;
  clearTimeout(status.t);
  status.t = setTimeout(() => ($('status').textContent = ''), 4000);
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  $('omdbKey').value = s.omdbKey;
  $('minRating').value = s.minRating;
  $('minVotes').value = s.minVotes;
  $('ottEnabled').checked = s.ottEnabled !== false;
});

$('save').addEventListener('click', () => {
  chrome.storage.sync.set(
    {
      omdbKey: $('omdbKey').value.trim(),
      minRating: Number($('minRating').value) || DEFAULTS.minRating,
      minVotes: Number($('minVotes').value) || 0,
      ottEnabled: $('ottEnabled').checked
    },
    () => status('Saved. Reload the cinema or streaming page to see changes.')
  );
});

$('test').addEventListener('click', () => {
  const apiKey = $('omdbKey').value.trim();
  if (!apiKey) return status('Enter a key first.');
  status('Testing…');
  chrome.runtime.sendMessage({ type: 'TEST_KEY', apiKey }, (res) => {
    status(res?.ok ? 'Key works ✓ (remember to Save)' : `Key failed: ${res?.error || 'unknown error'}`);
  });
});

$('clear').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, () => status('Cache cleared.'));
});
