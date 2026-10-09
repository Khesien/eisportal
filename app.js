// ─────────────────────────────────────────────────────────────────────────────
// EIS Staff Portal — v5.0 Clean (Complete Rewrite)
// ─────────────────────────────────────────────────────────────────────────────

// ── Supabase Init ─────────────────────────────────────────────────────────────
// Using _db to avoid conflicts with window.supabase (the library object)
const _db = window.supabase.createClient(
  'https://lpulcmxkaojmmuvjzsck.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdWxjbXhrYW9qbW11dmp6c2NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTI5NDIsImV4cCI6MjA5MTU2ODk0Mn0.gMwAchG7kyAsVrL4xjYV_DRTT-SIEG4ODB6TXRWgbwc'
);

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let deferredPrompt = null;

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escAttr(str) { return String(str || '').replace(/'/g, "\\'"); }

// ══════════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════
function showToast(title, message, type, duration) {
  type     = type     || 'info';
  message  = message  || '';
  duration = duration || 4000;
  var container = document.getElementById('toast-container');
  var icons = { success:'check-circle', error:'x-circle', warning:'alert-triangle', info:'info' };
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML =
    '<i data-lucide="' + (icons[type]||'info') + '" class="toast-icon"></i>' +
    '<div class="toast-body"><div class="toast-title">' + title + '</div>' +
    (message ? '<div class="toast-msg">' + message + '</div>' : '') + '</div>';
  container.appendChild(toast);
  lucide.createIcons();
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(function() { toast.remove(); }, 300);
  }, duration);
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW / NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
var views = {
  welcome:        document.getElementById('view-welcome'),
  login:          document.getElementById('view-login'),
  forgotPassword: document.getElementById('view-forgot-password'),
  register:       document.getElementById('view-register'),
  mentor:         document.getElementById('view-mentor-dashboard'),
  admin:          document.getElementById('view-admin-dashboard'),
  matshwane:      document.getElementById('view-matshwane-portal'),
};
var viewContainer = document.querySelector('.view-container');
var navHeader     = document.getElementById('main-nav');
var userDisplay   = document.getElementById('user-display');

function switchView(viewName) {
  views.welcome.classList.remove('active');
  views.welcome.classList.add('hidden');
  [views.login, views.forgotPassword, views.register, views.mentor, views.admin, views.matshwane].forEach(function(v) {
    if (v) { v.classList.add('hidden'); v.classList.remove('active'); }
  });

  var isDash = viewName === 'mentor' || viewName === 'admin' || viewName === 'matshwane';
  navHeader.classList.toggle('hidden', !isDash);
  viewContainer.classList.toggle('hidden', viewName === 'welcome');

  if (viewName === 'welcome') {
    views.welcome.classList.remove('hidden');
    views.welcome.classList.add('active');
  } else {
    var target = views[viewName];
    if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
  }
  if (isDash && currentProfile) {
    userDisplay.textContent = (currentProfile.full_name || currentProfile.email) + ' · ' + currentProfile.role.toUpperCase();
  }
  lucide.createIcons();
}

// ── Subtab Navigation ─────────────────────────────────────────────────────────
function initSubtabNavigation(sectionSelector) {
  var container = document.querySelector(sectionSelector);
  if (!container) return;
  var menuItems = container.querySelectorAll('.menu-item');
  var subtabs   = container.querySelectorAll('.subtab-content');
  menuItems.forEach(function(item) {
    item.addEventListener('click', function() {
      menuItems.forEach(function(mi) { mi.classList.remove('active'); });
      subtabs.forEach(function(st) { st.classList.add('hidden'); st.classList.remove('active'); });
      item.classList.add('active');
      var tabId = item.getAttribute('data-tab');
      var idMap = {
        'mentor-overview':'mentor-tab-overview', 'mentor-mentees':'mentor-tab-mentees',
        'mentor-schedule':'mentor-tab-schedule', 'mentor-wallet':'mentor-tab-wallet',
        'mentor-download':'mentor-tab-download', 'admin-users':'admin-tab-users',
        'admin-applications':'admin-tab-applications', 'admin-apikeys':'admin-tab-apikeys',
        'matshwane-oversight':'matshwane-tab-oversight', 'matshwane-roster':'matshwane-tab-roster',
        'matshwane-education':'matshwane-tab-education', 'matshwane-agreements':'matshwane-tab-agreements',
        'matshwane-audits':'matshwane-tab-audits',
      };
      var targetEl = container.querySelector('#' + (idMap[tabId] || tabId));
      if (targetEl) { targetEl.classList.remove('hidden'); targetEl.classList.add('active'); }
      var loaders = {
        'mentor-overview': loadMentorOverview, 'mentor-mentees': loadMentorMentees,
        'mentor-schedule': loadMentorMenteesDropdown, 'mentor-wallet': loadMentorWallet,
        'admin-users': loadAdminRegistry, 'admin-applications': loadMentorApplications,
        'admin-apikeys': loadAdminApiKeys, 'matshwane-oversight': loadMatshwaneOversight,
        'matshwane-roster': loadMatshwaneRoster, 'matshwane-education': loadMatshwaneEducation,
        'matshwane-agreements': loadMatshwaneAgreements, 'matshwane-audits': loadMatshwaneAudits,
      };
      if (loaders[tabId]) loaders[tabId]();
    });
  });
}
initSubtabNavigation('#view-mentor-dashboard');
initSubtabNavigation('#view-admin-dashboard');
initSubtabNavigation('#view-matshwane-portal');

// ── PWA Install ───────────────────────────────────────────────────────────────
var installPwaBtn = document.getElementById('install-pwa-btn');
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault(); deferredPrompt = e; installPwaBtn.classList.remove('hidden');
});
installPwaBtn.addEventListener('click', async function() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    var res = await deferredPrompt.userChoice;
    if (res.outcome === 'accepted') installPwaBtn.classList.add('hidden');
    deferredPrompt = null;
  }
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/service-worker.js').catch(function() {});
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH — Helpers
// ══════════════════════════════════════════════════════════════════════════════
function resetLoginBtn() {
  var btn = document.getElementById('login-submit');
  if (btn) { btn.disabled = false; btn.innerHTML = 'Sign In <i data-lucide="arrow-right"></i>'; lucide.createIcons(); }
}

async function handleSignOut() {
  await _db.auth.signOut();
  currentUser = null;
  currentProfile = null;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH — Supabase State Change Listener
// ══════════════════════════════════════════════════════════════════════════════
_db.auth.onAuthStateChange(async function(event, session) {
  if (session && session.user) {
    currentUser = session.user;

    var result = await _db.from('profiles').select('*').eq('id', currentUser.id).single();
    var profile = result.data;
    var profileError = result.error;

    if (profileError || !profile) {
      resetLoginBtn();
      showToast(
        'Profile Not Found',
        'Your login was successful but no staff profile exists. Please contact your administrator.',
        'error', 8000
      );
      await _db.auth.signOut();
      return;
    }

    currentProfile = profile;
    resetLoginBtn();

    if (profile.role === 'admin') {
      switchView('admin');
      var nameEl = document.getElementById('admin-name-display');
      if (nameEl) nameEl.textContent = profile.full_name || profile.email;
      loadAdminRegistry();
    } else if (profile.role === 'matshwane') {
      switchView('matshwane');
      loadMatshwaneOversight();
    } else if (profile.role === 'mentor') {
      if (profile.status === 'pending' || profile.status === 'rejected') {
        showToast('Access Pending', 'Your mentor application is still under review. Please check back later.', 'warning', 7000);
        await _db.auth.signOut();
        return;
      }
      switchView('mentor');
      var mentorNameEl   = document.getElementById('mentor-name-display');
      var mentorAvatarEl = document.getElementById('mentor-avatar');
      if (mentorNameEl)   mentorNameEl.textContent   = profile.full_name || profile.email;
      if (mentorAvatarEl) mentorAvatarEl.textContent = (profile.full_name || 'M')[0].toUpperCase();
      loadMentorOverview();
    } else {
      resetLoginBtn();
      showToast('Access Denied', 'Role "' + profile.role + '" cannot log in here. Students must use the EIS mobile app.', 'error', 6000);
      await _db.auth.signOut();
    }
  } else {
    currentUser    = null;
    currentProfile = null;
    resetLoginBtn();
    switchView('welcome');
  }
  lucide.createIcons();
});

// ══════════════════════════════════════════════════════════════════════════════
// WELCOME PAGE BUTTONS
// ══════════════════════════════════════════════════════════════════════════════
document.getElementById('welcome-login-btn').addEventListener('click', function() { switchView('login'); });
document.getElementById('welcome-apply-btn').addEventListener('click', function() { switchView('register'); });
document.getElementById('hero-login-btn').addEventListener('click',    function() { switchView('login'); });
document.getElementById('hero-apply-btn').addEventListener('click',    function() { switchView('register'); });

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN FORM
// ══════════════════════════════════════════════════════════════════════════════
function setLoginError(msg) {
  var el = document.getElementById('login-error-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'login-error-msg';
    el.style.cssText = 'background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;padding:10px 14px;' +
      'border-radius:10px;font-size:13px;font-weight:600;margin-bottom:14px;display:none;';
    var form = document.getElementById('login-form');
    form.insertBefore(el, form.firstChild);
  }
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var eisId    = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  var btn      = document.getElementById('login-submit');

  setLoginError('');

  if (!eisId || !password) {
    setLoginError('Please enter your EIS Ticket Number and password.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    var loginEmail = eisId;
    if (eisId.indexOf('@') === -1) {
      var resolver = await _db.rpc('resolve_ticket', { p_ticket: eisId });
      if (resolver.error || !resolver.data || resolver.data.length === 0) {
        setLoginError('Invalid EIS Ticket Number. Could not resolve user.');
        resetLoginBtn();
        return;
      }
      loginEmail = resolver.data[0].resolved_email;
    }

    var res = await _db.auth.signInWithPassword({ email: loginEmail, password: password });

    if (res.error) {
      var msg = res.error.message || 'Unknown error occurred';
      if (msg.indexOf('Invalid login credentials') !== -1)   msg = 'Incorrect email or password. Please try again.';
      else if (msg.indexOf('Email not confirmed') !== -1)    msg = 'Please confirm your email address first — check your inbox.';
      else if (msg.indexOf('Too many') !== -1)               msg = 'Too many attempts. Please wait a few minutes and try again.';
      setLoginError(msg);
      resetLoginBtn();
    }
    // On success: onAuthStateChange fires and handles routing + resetLoginBtn
  } catch (err) {
    setLoginError('An unexpected error occurred: ' + (err.message || 'Unknown error'));
    resetLoginBtn();
  }
});

// ── Password eye toggle — Login ───────────────────────────────────────────────
var toggleLoginPwd = document.getElementById('toggle-login-password');
if (toggleLoginPwd) {
  toggleLoginPwd.addEventListener('click', function() {
    var inp  = document.getElementById('login-password');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    toggleLoginPwd.innerHTML = show ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
    lucide.createIcons();
  });
}

// ── Password eye toggle — Register ───────────────────────────────────────────
var toggleRegPwd = document.getElementById('toggle-reg-password');
if (toggleRegPwd) {
  toggleRegPwd.addEventListener('click', function() {
    var inp  = document.getElementById('reg-password');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    toggleRegPwd.innerHTML = show ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
    lucide.createIcons();
  });
}

// ── Login page navigation ─────────────────────────────────────────────────────
document.getElementById('go-register-btn').addEventListener('click', function(e) { e.preventDefault(); switchView('register'); });
document.getElementById('login-back-welcome').addEventListener('click', function(e) { e.preventDefault(); switchView('welcome'); });

// ══════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ══════════════════════════════════════════════════════════════════════════════
document.getElementById('forgot-password-btn').addEventListener('click', function() { switchView('forgotPassword'); });
document.getElementById('forgot-back-login').addEventListener('click', function(e) { e.preventDefault(); switchView('login'); });

document.getElementById('forgot-password-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email = document.getElementById('forgot-email').value.trim();
  var btn   = document.getElementById('forgot-submit');

  btn.disabled = true;
  btn.textContent = 'Sending...';

  var res = await _db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });

  btn.disabled = false;
  btn.innerHTML = 'Send Reset Link <i data-lucide="send"></i>';
  lucide.createIcons();

  if (res.error) {
    showToast('Error', res.error.message, 'error');
  } else {
    showToast('Email Sent', 'A password reset link has been sent to ' + email + '. Check your inbox and spam folder.', 'success', 7000);
    document.getElementById('forgot-password-form').reset();
    setTimeout(function() { switchView('login'); }, 2000);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SIGN OUT
// ══════════════════════════════════════════════════════════════════════════════
document.getElementById('logout-btn').addEventListener('click', handleSignOut);

// ══════════════════════════════════════════════════════════════════════════════
// MENTOR REGISTRATION / APPLICATION FORM
// ══════════════════════════════════════════════════════════════════════════════
document.getElementById('register-back-btn').addEventListener('click', function(e) { e.preventDefault(); switchView('login'); });
document.getElementById('reg-go-login').addEventListener('click', function(e) { e.preventDefault(); switchView('login'); });

document.getElementById('mentor-apply-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var name          = document.getElementById('reg-name').value.trim();
  var email         = document.getElementById('reg-email').value.trim();
  var password      = document.getElementById('reg-password').value;
  var phone         = document.getElementById('reg-phone').value.trim();
  var subjects      = document.getElementById('reg-subjects').value.trim().split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var qualification = document.getElementById('reg-qualification').value.trim();
  var bio           = document.getElementById('reg-bio').value.trim();
  var btn           = document.getElementById('register-submit');

  if (password.length < 6) {
    showToast('Weak Password', 'Password must be at least 6 characters.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2"></i> Submitting...';
  lucide.createIcons();

  var appRes = await _db.from('mentor_applications').insert({
    name: name, email: email, subjects: subjects,
    bio: bio + '\n\nQualification: ' + qualification + '\nPhone: ' + phone,
    status: 'pending',
  });

  if (appRes.error) {
    showToast('Submission Failed', appRes.error.message, 'error');
    btn.disabled = false;
    btn.innerHTML = 'Submit Application <i data-lucide="check"></i>';
    lucide.createIcons();
    return;
  }

  var authRes = await _db.auth.signUp({
    email: email, password: password,
    options: { data: { full_name: name, role: 'mentor' }, emailRedirectTo: window.location.origin },
  });
  if (authRes.error && authRes.error.message.indexOf('already registered') === -1) {
    console.warn('Auth signup warning:', authRes.error.message);
  }

  showToast('Application Submitted!', 'Your mentor application has been received. Our admin team will review it within 24–48 hours.', 'success', 8000);
  document.getElementById('mentor-apply-form').reset();
  btn.disabled = false;
  btn.innerHTML = 'Submit Application <i data-lucide="check"></i>';
  lucide.createIcons();
  setTimeout(function() { switchView('login'); }, 3000);
});

// ══════════════════════════════════════════════════════════════════════════════
// MENTOR DASHBOARD — LOADERS
// ══════════════════════════════════════════════════════════════════════════════
async function loadMentorOverview() {
  if (!currentProfile) return;
  var mentorId = currentProfile.id;

  var menteesRes = await _db.from('assignments').select('*', { count: 'exact', head: true }).eq('mentor_id', mentorId);
  document.getElementById('m-stat-mentees').textContent = menteesRes.count != null ? menteesRes.count : 0;

  var sessionsRes = await _db.from('academic_sessions').select('*', { count: 'exact', head: true })
    .eq('mentor_id', mentorId).eq('status', 'completed');
  document.getElementById('m-stat-sessions').textContent = sessionsRes.count != null ? sessionsRes.count : 0;

  var ledgerRes = await _db.from('wallet_ledger').select('*').eq('user_id', mentorId);
  var balance = ledgerRes.data ? ledgerRes.data.reduce(function(acc, r) {
    return acc + (r.type === 'credit' ? +r.amount : -r.amount);
  }, 0) : 0;
  document.getElementById('m-stat-balance').textContent = 'R' + balance.toFixed(2);

  var sessionsList = document.getElementById('mentor-sessions-list');
  var upcomingRes = await _db.from('academic_sessions').select('*')
    .eq('mentor_id', mentorId)
    .not('status', 'in', '("cancelled","completed")')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  var sessions = upcomingRes.data;
  if (!sessions || sessions.length === 0) {
    sessionsList.innerHTML = '<p class="empty-msg">No upcoming sessions. Schedule one in the Schedule tab.</p>';
    return;
  }
  sessionsList.innerHTML = '';
  sessions.forEach(function(session) {
    var card = document.createElement('div');
    card.className = 'session-item-card';
    card.innerHTML =
      '<div class="session-info-core">' +
        '<span class="session-topic-title">' + escHtml(session.topic) + '</span>' +
        '<span class="session-time-text">' +
          '<i data-lucide="calendar" style="width:13px;height:13px;"></i> ' + session.date +
          ' &nbsp;·&nbsp; <i data-lucide="clock" style="width:13px;height:13px;"></i> ' + session.time +
          ' &nbsp;(' + session.duration + ' min)' +
        '</span>' +
      '</div>' +
      '<div class="session-actions">' +
        '<button class="complete-session-btn" onclick="completeSession(\'' + session.id + '\')">Complete</button>' +
        '<button class="cancel-session-btn" onclick="cancelSession(\'' + session.id + '\')">Cancel</button>' +
      '</div>';
    sessionsList.appendChild(card);
  });
  lucide.createIcons();
}

window.completeSession = async function(sessionId) {
  if (!confirm('Mark this session as completed and credit your wallet?')) return;
  var res = await _db.from('academic_sessions').update({ status: 'completed' }).eq('id', sessionId);
  if (!res.error) {
    await _db.from('wallet_ledger').insert({
      user_id: currentProfile.id, amount: 50.00, type: 'credit',
      description: 'Session completed (ID: ' + sessionId.substring(0, 8) + ')',
    });
    showToast('Session Completed', 'R50.00 has been credited to your wallet.', 'success');
    loadMentorOverview();
  } else { showToast('Error', res.error.message, 'error'); }
};

window.cancelSession = async function(sessionId) {
  if (!confirm('Cancel this session?')) return;
  var res = await _db.from('academic_sessions').update({ status: 'cancelled' }).eq('id', sessionId);
  if (!res.error) { showToast('Session Cancelled', 'The session has been cancelled.', 'info'); loadMentorOverview(); }
  else { showToast('Error', res.error.message, 'error'); }
};

async function loadMentorMentees() {
  if (!currentProfile) return;
  var menteeList = document.getElementById('mentor-mentee-list');
  menteeList.innerHTML = '<p class="empty-msg">Loading...</p>';

  var assRes = await _db.from('assignments').select('mentee_id').eq('mentor_id', currentProfile.id);
  if (!assRes.data || assRes.data.length === 0) {
    menteeList.innerHTML = '<p class="empty-msg">No mentees assigned yet. Contact admin to request assignments.</p>';
    return;
  }
  var menteeIds = assRes.data.map(function(a) { return a.mentee_id; });
  var studRes = await _db.from('profiles').select('*').in('id', menteeIds);
  var students = studRes.data;
  if (!students || students.length === 0) {
    menteeList.innerHTML = '<p class="empty-msg">No mentees found.</p>';
    return;
  }
  menteeList.innerHTML = '';
  students.forEach(function(student) {
    var card = document.createElement('div');
    card.className = 'mentee-card-item';
    card.innerHTML =
      '<div class="session-info-core">' +
        '<span class="session-topic-title">' + escHtml(student.full_name || student.email) + '</span>' +
        '<span class="session-time-text"><i data-lucide="hash" style="width:13px;height:13px;"></i> ' +
          (student.ticket_number || 'No ticket') + ' &nbsp;·&nbsp; ' + (student.academic_level || 'Primary') +
        '</span>' +
      '</div>' +
      '<span class="status-pill active-pill">' + escHtml(student.status || 'ACTIVE') + '</span>';
    menteeList.appendChild(card);
  });
  lucide.createIcons();
}

async function loadMentorMenteesDropdown() {
  if (!currentProfile) return;
  var dropdown = document.getElementById('sched-mentee');
  var assRes = await _db.from('assignments').select('mentee_id').eq('mentor_id', currentProfile.id);
  if (!assRes.data || assRes.data.length === 0) {
    dropdown.innerHTML = '<option value="">No students assigned yet</option>';
    return;
  }
  var menteeIds = assRes.data.map(function(a) { return a.mentee_id; });
  var studRes = await _db.from('profiles').select('id,full_name,email').in('id', menteeIds);
  dropdown.innerHTML = '<option value="">Select a student...</option>';
  if (studRes.data) {
    studRes.data.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.full_name || s.email;
      dropdown.appendChild(opt);
    });
  }
}

document.getElementById('mentor-schedule-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var studentId = document.getElementById('sched-mentee').value;
  var date      = document.getElementById('sched-date').value;
  var time      = document.getElementById('sched-time').value;
  var duration  = parseInt(document.getElementById('sched-duration').value);
  var topic     = document.getElementById('sched-topic').value.trim();

  if (!studentId) { showToast('Select Student', 'Please select a student first.', 'warning'); return; }

  var res = await _db.from('academic_sessions').insert({
    mentor_id: currentProfile.id, student_id: studentId,
    date: date, time: time, duration: duration, topic: topic, status: 'scheduled',
  });
  if (!res.error) {
    showToast('Session Scheduled!', 'Session on ' + date + ' at ' + time + ' has been created.', 'success');
    document.getElementById('mentor-schedule-form').reset();
    loadMentorOverview();
  } else { showToast('Error', res.error.message, 'error'); }
});

async function loadMentorWallet() {
  if (!currentProfile) return;
  var ledgerRes = await _db.from('wallet_ledger').select('*').eq('user_id', currentProfile.id);
  var balance = 0, withdrawn = 0;
  if (ledgerRes.data) {
    balance   = ledgerRes.data.reduce(function(acc, r) { return acc + (r.type === 'credit' ? +r.amount : -r.amount); }, 0);
    withdrawn = ledgerRes.data.filter(function(r) { return r.type === 'debit'; }).reduce(function(acc, r) { return acc + +r.amount; }, 0);
  }
  document.getElementById('mentor-wallet-balance').textContent    = 'R' + balance.toFixed(2);
  document.getElementById('mentor-wallet-withdrawn').textContent  = 'R' + withdrawn.toFixed(2);
}

document.getElementById('mentor-payout-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var amount = parseFloat(document.getElementById('payout-amount').value);
  var ledgerRes = await _db.from('wallet_ledger').select('*').eq('user_id', currentProfile.id);
  var balance = ledgerRes.data ? ledgerRes.data.reduce(function(acc, r) { return acc + (r.type === 'credit' ? +r.amount : -r.amount); }, 0) : 0;

  if (amount > balance) { showToast('Insufficient Balance', 'Your available balance is R' + balance.toFixed(2) + '.', 'warning'); return; }

  var res = await _db.from('wallet_ledger').insert({
    user_id: currentProfile.id, amount: amount, type: 'debit', description: 'Payout withdrawal request',
  });
  if (!res.error) {
    showToast('Payout Requested', 'R' + amount.toFixed(2) + ' payout request submitted. Processed within 24 hours.', 'success');
    document.getElementById('mentor-payout-form').reset();
    loadMentorWallet(); loadMentorOverview();
  } else { showToast('Error', res.error.message, 'error'); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD — LOADERS
// ══════════════════════════════════════════════════════════════════════════════
async function loadAdminRegistry() {
  var table = document.getElementById('admin-users-table');
  table.innerHTML = '<tr><td colspan="5" class="empty-msg">Loading...</td></tr>';
  var res = await _db.from('profiles').select('*').order('created_at', { ascending: false });
  if (res.error) { showToast('Error', res.error.message, 'error'); return; }
  var users = res.data;
  if (!users || users.length === 0) { table.innerHTML = '<tr><td colspan="5" class="empty-msg">No users found.</td></tr>'; return; }
  table.innerHTML = '';
  users.forEach(function(u) {
    var rolePill = u.role === 'admin' ? 'admin-pill' : u.role === 'matshwane' ? 'matshwane-pill' : 'active-pill';
    var row = document.createElement('tr');
    row.innerHTML =
      '<td><strong>' + escHtml(u.full_name || '—') + '</strong></td>' +
      '<td>' + escHtml(u.email) + '</td>' +
      '<td><span class="status-pill ' + rolePill + '">' + u.role.toUpperCase() + '</span></td>' +
      '<td><span class="status-pill active-pill">' + escHtml(u.status || 'active') + '</span></td>' +
      '<td><button class="api-action-btn" onclick="deleteUser(\'' + u.id + '\')">Delete</button></td>';
    table.appendChild(row);
  });
}
document.getElementById('admin-refresh-registry-btn').addEventListener('click', loadAdminRegistry);

window.deleteUser = async function(userId) {
  if (userId === (currentProfile && currentProfile.id)) { showToast('Not Allowed', 'You cannot delete your own account.', 'warning'); return; }
  if (!confirm('Permanently delete this user profile?')) return;
  var res = await _db.from('profiles').delete().eq('id', userId);
  if (!res.error) { showToast('Deleted', 'User profile removed.', 'success'); loadAdminRegistry(); }
  else { showToast('Error', res.error.message, 'error'); }
};

async function loadMentorApplications() {
  var list = document.getElementById('admin-applications-list');
  list.innerHTML = '<p class="empty-msg">Loading...</p>';
  var res = await _db.from('mentor_applications').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  if (res.error) {
    res = await _db.from('mentor_applications').select('*').eq('status', 'pending').order('submitted_at', { ascending: false });
  }
  if (res.error) {
    res = await _db.from('mentor_applications').select('*').eq('status', 'pending');
  }
  if (res.error) { showToast('Error', res.error.message, 'error'); return; }
  var apps = res.data;
  if (!apps || apps.length === 0) { list.innerHTML = '<p class="empty-msg">No pending mentor applications.</p>'; return; }
  list.innerHTML = '';
  apps.forEach(function(app) {
    var appName = app.name || ((app.first_name || '') + ' ' + (app.last_name || '')).trim() || 'Applicant';
    var card = document.createElement('div');
    card.className = 'application-card';
    card.innerHTML =
      '<div class="app-header">' +
        '<div><div class="app-title">' + escHtml(appName) + '</div><div class="app-email">' + escHtml(app.email || 'N/A') + '</div></div>' +
        '<span class="status-pill" style="background:#fef3c7;color:#d97706;">PENDING</span>' +
      '</div>' +
      '<div class="app-meta"><strong>Subjects:</strong> ' + escHtml(Array.isArray(app.subjects) ? app.subjects.join(', ') : app.subjects || '—') +
        '<br><strong>Background:</strong> ' + escHtml(app.bio || app.experience_elaboration || '—') + '</div>' +
      '<div class="app-actions">' +
        '<button class="approve-btn" onclick="approveApplication(\'' + app.id + '\',\'' + escAttr(appName) + '\',\'' + escAttr(app.email) + '\')">✓ Approve</button>' +
        '<button class="reject-btn" onclick="rejectApplication(\'' + app.id + '\')">✕ Reject</button>' +
      '</div>';
    list.appendChild(card);
  });
}
document.getElementById('admin-refresh-apps-btn').addEventListener('click', loadMentorApplications);

window.approveApplication = async function(appId, name, email) {
  if (!confirm('Approve mentor application for ' + name + '?')) return;
  var appRes = await _db.from('mentor_applications').update({ status: 'approved' }).eq('id', appId);
  if (appRes.error) { showToast('Error', appRes.error.message, 'error'); return; }

  var profRes = await _db.from('profiles').select('id').eq('email', email).single();
  var ticketNumber = 'EIS-MT-' + Math.floor(1000 + Math.random() * 9000);

  if (profRes.data) {
    await _db.from('profiles').update({ role: 'mentor', status: 'active', ticket_number: ticketNumber }).eq('id', profRes.data.id);
  } else {
    await _db.from('profiles').insert({ full_name: name, email: email, role: 'mentor', status: 'active', ticket_number: ticketNumber });
  }
  showToast('Application Approved', name + ' is now an active mentor. Ticket: ' + ticketNumber, 'success', 7000);
  loadMentorApplications();
};

window.rejectApplication = async function(appId) {
  if (!confirm('Reject this application?')) return;
  var res = await _db.from('mentor_applications').update({ status: 'rejected' }).eq('id', appId);
  if (!res.error) { showToast('Application Rejected', 'The application has been rejected.', 'info'); loadMentorApplications(); }
  else { showToast('Error', res.error.message, 'error'); }
};

// ── API Keys ──────────────────────────────────────────────────────────────────
async function loadAdminApiKeys() {
  var table = document.getElementById('admin-apikeys-table');
  table.innerHTML = '<tr><td colspan="6" class="empty-msg">Loading...</td></tr>';
  var res = await _db.from('api_keys').select('*').order('created_at', { ascending: false });
  if (res.error) { showToast('Error', res.error.message, 'error'); return; }
  var keys = res.data;
  if (!keys || keys.length === 0) { table.innerHTML = '<tr><td colspan="6" class="empty-msg">No API keys yet.</td></tr>'; return; }
  table.innerHTML = '';
  keys.forEach(function(k) {
    var perms = k.permissions ? Object.keys(k.permissions).filter(function(p) { return k.permissions[p]; }).join(', ').toUpperCase() : 'READ';
    var row = document.createElement('tr');
    row.innerHTML =
      '<td><strong>' + escHtml(k.name) + '</strong></td>' +
      '<td>' + new Date(k.created_at).toLocaleDateString() + '</td>' +
      '<td><span class="status-pill active-pill">' + perms + '</span></td>' +
      '<td><div class="token-container"><span>' + k.key.substring(0, 14) + '…</span>' +
        '<button class="copy-btn" onclick="copyKeyText(\'' + escAttr(k.key) + '\')" title="Copy key"><i data-lucide="copy"></i></button></div></td>' +
      '<td><span class="status-pill ' + (k.is_active ? 'active-pill' : '') + '" style="' + (!k.is_active ? 'background:#fee2e2;color:#dc2626;' : '') + '">' +
        (k.is_active ? 'ACTIVE' : 'REVOKED') + '</span></td>' +
      '<td>' + (k.is_active ? '<button class="api-action-btn" onclick="revokeKey(\'' + k.id + '\')">Revoke</button>' :
        '<button class="api-action-btn" onclick="deleteKey(\'' + k.id + '\')">Delete</button>') + '</td>';
    table.appendChild(row);
  });
  lucide.createIcons();
}

window.copyKeyText = function(keyText) {
  navigator.clipboard.writeText(keyText).then(function() { showToast('Copied!', 'API key copied to clipboard.', 'success'); });
};
window.revokeKey = async function(keyId) {
  if (!confirm('Revoke this API key? It will stop working immediately.')) return;
  var res = await _db.from('api_keys').update({ is_active: false }).eq('id', keyId);
  if (!res.error) { showToast('Key Revoked', 'The API key has been revoked.', 'warning'); loadAdminApiKeys(); }
  else { showToast('Error', res.error.message, 'error'); }
};
window.deleteKey = async function(keyId) {
  if (!confirm('Permanently delete this API key?')) return;
  var res = await _db.from('api_keys').delete().eq('id', keyId);
  if (!res.error) { showToast('Key Deleted', 'The API key has been permanently removed.', 'info'); loadAdminApiKeys(); }
  else { showToast('Error', res.error.message, 'error'); }
};

var newKeyBtn   = document.getElementById('admin-new-key-btn');
var keyFormBox  = document.getElementById('admin-key-generator-box');
var keyCancelBtn = document.getElementById('admin-key-cancel');
newKeyBtn.addEventListener('click', function() { keyFormBox.classList.remove('hidden'); newKeyBtn.classList.add('hidden'); });
keyCancelBtn.addEventListener('click', function() { keyFormBox.classList.add('hidden'); newKeyBtn.classList.remove('hidden'); });

document.getElementById('admin-key-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var name  = document.getElementById('key-name').value.trim();
  var read  = document.getElementById('key-perm-read').checked;
  var write = document.getElementById('key-perm-write').checked;
  var admin = document.getElementById('key-perm-admin').checked;
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var rand  = Array.from({ length: 48 }, function() { return chars[Math.floor(Math.random() * chars.length)]; }).join('');
  var key   = 'eis_live_' + rand;
  var res = await _db.from('api_keys').insert({ name: name, key: key, permissions: { read: read, write: write, admin: admin }, created_by: currentUser.id, is_active: true });
  if (!res.error) {
    navigator.clipboard.writeText(key).catch(function() {});
    showToast('Key Generated!', 'Key: ' + key.substring(0, 20) + '… — Copied to clipboard. Store it securely.', 'success', 9000);
    document.getElementById('admin-key-form').reset();
    keyFormBox.classList.add('hidden'); newKeyBtn.classList.remove('hidden');
    loadAdminApiKeys();
  } else { showToast('Error', res.error.message, 'error'); }
});

// ══════════════════════════════════════════════════════════════════════════════
// MATSHWANE PORTAL — LOADERS & ACTIONS
// ══════════════════════════════════════════════════════════════════════════════
var currentReportFilter = 'all';

async function loadMatshwaneOversight() {
  var list = document.getElementById('matshwane-reports-list');
  if (!list) return;
  list.innerHTML = '<p class="empty-msg">Loading disciplinary reports...</p>';

  var res = await _db.from('violation_reports').select('*').order('created_at', { ascending: false });
  if (res.error) {
    res = await _db.from('violation_reports').select('*').order('timestamp', { ascending: false });
  }
  if (res.error) {
    res = await _db.from('violation_reports').select('*');
  }

  if (res.error) {
    showToast('Error Loading Oversight', res.error.message, 'error');
    list.innerHTML = '<p class="empty-msg">Error loading reports.</p>';
    return;
  }

  var reports = res.data || [];
  if (currentReportFilter === 'pending') {
    reports = reports.filter(function(r) { return r.status === 'pending' || !r.status; });
  } else if (currentReportFilter === 'resolved') {
    reports = reports.filter(function(r) { return r.status === 'resolved'; });
  }

  if (reports.length === 0) {
    list.innerHTML = '<p class="empty-msg">No active disciplinary reports matching criteria.</p>';
    return;
  }

  list.innerHTML = '';
  reports.forEach(function(rep) {
    var card = document.createElement('div');
    card.className = 'complaint-card';
    var isResolved = rep.status === 'resolved';
    var isDismissed = rep.status === 'dismissed';
    var statusBadge = isResolved
      ? '<span class="status-pill active-pill">RESOLVED</span>'
      : isDismissed
        ? '<span class="status-pill" style="background:#f3f4f6;color:#6b7280;">DISMISSED</span>'
        : '<span class="status-pill" style="background:#fee2e2;color:#dc2626;">PENDING ACTION</span>';

    var reportDate = rep.created_at || rep.timestamp || rep.submitted_at;
    var formattedDate = reportDate ? new Date(reportDate).toLocaleString() : 'N/A';

    card.innerHTML =
      '<div class="complaint-header">' +
        '<span class="complaint-reporter">Reporter ID: ' + (rep.is_anonymous ? 'Anonymous' : escHtml(rep.reporter_id || 'N/A')) + '</span>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          statusBadge +
          '<span class="complaint-severity severity-' + (rep.severity || 'med').toLowerCase() + '">' + (rep.severity || 'MEDIUM').toUpperCase() + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="complaint-body">' +
        '<strong>Target Person:</strong> ' + escHtml(rep.target_name || rep.target_user_id || 'N/A') + '<br>' +
        '<strong>Description:</strong> ' + escHtml(rep.description || 'No details provided.') +
      '</div>' +
      '<div class="session-time-text" style="margin-top:8px;"><i data-lucide="clock" style="width:13px;height:13px;"></i> Reported: ' + formattedDate + '</div>' +
      (!isResolved && !isDismissed ?
        '<div class="app-actions" style="margin-top:12px;">' +
          '<button class="approve-btn" onclick="resolveViolationReport(\'' + rep.id + '\')">✓ Resolve & Clear</button>' +
          '<button class="reject-btn" onclick="dismissViolationReport(\'' + rep.id + '\')">✕ Dismiss</button>' +
        '</div>' : ''
      );
    list.appendChild(card);
  });
  lucide.createIcons();
}

window.resolveViolationReport = async function(id) {
  if (!confirm('Mark this disciplinary report as resolved?')) return;
  var res = await _db.from('violation_reports').update({ status: 'resolved' }).eq('id', id);
  if (!res.error) {
    showToast('Report Resolved', 'The report has been marked as resolved.', 'success');
    loadMatshwaneOversight();
  } else {
    showToast('Error', res.error.message, 'error');
  }
};

window.dismissViolationReport = async function(id) {
  if (!confirm('Dismiss this disciplinary report?')) return;
  var res = await _db.from('violation_reports').update({ status: 'dismissed' }).eq('id', id);
  if (!res.error) {
    showToast('Report Dismissed', 'The report has been dismissed.', 'info');
    loadMatshwaneOversight();
  } else {
    showToast('Error', res.error.message, 'error');
  }
};

// ── Report Filter Listeners ──
document.addEventListener('click', function(e) {
  if (e.target && e.target.id === 'filter-rep-all') {
    currentReportFilter = 'all';
    updateFilterBtns('filter-rep-all');
    loadMatshwaneOversight();
  } else if (e.target && e.target.id === 'filter-rep-pending') {
    currentReportFilter = 'pending';
    updateFilterBtns('filter-rep-pending');
    loadMatshwaneOversight();
  } else if (e.target && e.target.id === 'filter-rep-resolved') {
    currentReportFilter = 'resolved';
    updateFilterBtns('filter-rep-resolved');
    loadMatshwaneOversight();
  }
});

function updateFilterBtns(activeId) {
  ['filter-rep-all', 'filter-rep-pending', 'filter-rep-resolved'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) {
      if (id === activeId) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
}

// ── Refresh Button Listeners ──
var refreshReportsBtn = document.getElementById('matshwane-refresh-reports-btn');
if (refreshReportsBtn) refreshReportsBtn.addEventListener('click', loadMatshwaneOversight);

var refreshRosterBtn = document.getElementById('matshwane-refresh-roster-btn');
if (refreshRosterBtn) refreshRosterBtn.addEventListener('click', loadMatshwaneRoster);

var refreshEduBtn = document.getElementById('matshwane-refresh-edu-btn');
if (refreshEduBtn) refreshEduBtn.addEventListener('click', loadMatshwaneEducation);

var refreshAgreementsBtn = document.getElementById('matshwane-refresh-agreements-btn');
if (refreshAgreementsBtn) refreshAgreementsBtn.addEventListener('click', loadMatshwaneAgreements);

var refreshAuditsBtn = document.getElementById('matshwane-refresh-audits-btn');
if (refreshAuditsBtn) refreshAuditsBtn.addEventListener('click', loadMatshwaneAudits);

// ── Matshwane Registry & Roster Loader ──
async function loadMatshwaneRoster() {
  var appList = document.getElementById('matshwane-applications-list');
  if (appList) {
    appList.innerHTML = '<p class="empty-msg">Loading applications...</p>';
    var appRes = await _db.from('mentor_applications').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (appRes.error) {
      appRes = await _db.from('mentor_applications').select('*').eq('status', 'pending').order('submitted_at', { ascending: false });
    }
    if (appRes.error) {
      appRes = await _db.from('mentor_applications').select('*').eq('status', 'pending');
    }

    var apps = (appRes && appRes.data) || [];
    if (apps.length === 0) {
      appList.innerHTML = '<p class="empty-msg">No pending mentor applications in registry.</p>';
    } else {
      appList.innerHTML = '';
      apps.forEach(function(app) {
        var card = document.createElement('div');
        card.className = 'application-card';
        var appName = app.name || ((app.first_name || '') + ' ' + (app.last_name || '')).trim() || 'Applicant';
        card.innerHTML =
          '<div class="app-header">' +
            '<div><div class="app-title">' + escHtml(appName) + '</div><div class="app-email">' + escHtml(app.email || 'N/A') + '</div></div>' +
            '<span class="status-pill" style="background:#fef3c7;color:#d97706;">PENDING REVIEW</span>' +
          '</div>' +
          '<div class="app-meta">' +
            '<strong>Subjects:</strong> ' + escHtml(Array.isArray(app.subjects) ? app.subjects.join(', ') : app.subjects || '—') + '<br>' +
            '<strong>Academy / Tertiary:</strong> ' + escHtml(app.academy || app.tertiary_year || 'N/A') + '<br>' +
            '<strong>Background:</strong> ' + escHtml(app.bio || app.experience_elaboration || '—') +
          '</div>' +
          '<div class="app-actions">' +
            '<button class="approve-btn" onclick="approveMatshwaneApp(\'' + app.id + '\', \'' + escAttr(appName) + '\', \'' + escAttr(app.email) + '\')">✓ Approve Mentor</button>' +
            '<button class="reject-btn" onclick="rejectMatshwaneApp(\'' + app.id + '\')">✕ Reject</button>' +
          '</div>';
        appList.appendChild(card);
      });
    }
  }

  var rosterTable = document.getElementById('matshwane-roster-table');
  if (rosterTable) {
    rosterTable.innerHTML = '<tr><td colspan="5" class="empty-msg">Loading roster...</td></tr>';
    var profRes = await _db.from('profiles').select('*').eq('role', 'mentor').order('created_at', { ascending: false });
    if (profRes.error) {
      profRes = await _db.from('profiles').select('*').eq('role', 'mentor');
    }

    var mentors = (profRes && profRes.data) || [];
    if (mentors.length === 0) {
      rosterTable.innerHTML = '<tr><td colspan="5" class="empty-msg">No mentors registered in database.</td></tr>';
      return;
    }
    rosterTable.innerHTML = '';
    mentors.forEach(function(m) {
      var isSuspended = m.status === 'suspended';
      var row = document.createElement('tr');
      row.innerHTML =
        '<td><strong>' + escHtml(m.full_name || m.name || '—') + '</strong></td>' +
        '<td>' + escHtml(m.email) + '</td>' +
        '<td><code style="font-size:12px;color:var(--color-primary);font-weight:600;">' + escHtml(m.ticket_number || 'N/A') + '</code></td>' +
        '<td><span class="status-pill ' + (isSuspended ? '' : 'active-pill') + '" style="' + (isSuspended ? 'background:#fee2e2;color:#dc2626;' : '') + '">' +
          escHtml((m.status || 'active').toUpperCase()) + '</span></td>' +
        '<td>' +
          (!isSuspended
            ? '<button class="api-action-btn" style="color:#dc2626;" onclick="suspendMatshwaneMentor(\'' + m.id + '\')">Suspend</button>'
            : '<button class="api-action-btn" style="color:#059669;" onclick="reinstateMatshwaneMentor(\'' + m.id + '\')">Reinstate</button>') +
        '</td>';
      rosterTable.appendChild(row);
    });
  }
}

window.approveMatshwaneApp = async function(appId, name, email) {
  if (!confirm('Approve mentor application for ' + name + '?')) return;
  var formalId = 'EIS-MT-' + Math.floor(1000 + Math.random() * 9000);

  var appRes = await _db.from('mentor_applications').update({ status: 'approved', ticket_number: formalId }).eq('id', appId);
  if (appRes.error) { showToast('Error', appRes.error.message, 'error'); return; }

  var profRes = await _db.from('profiles').select('id').eq('email', email).single();
  if (profRes.data) {
    await _db.from('profiles').update({ role: 'mentor', status: 'active', ticket_number: formalId }).eq('id', profRes.data.id);
  } else {
    await _db.from('profiles').insert({ full_name: name, email: email, role: 'mentor', status: 'active', ticket_number: formalId });
  }

  showToast('Application Approved', name + ' approved. Ticket: ' + formalId, 'success', 7000);
  loadMatshwaneRoster();
};

window.rejectMatshwaneApp = async function(appId) {
  if (!confirm('Reject this mentor application?')) return;
  var res = await _db.from('mentor_applications').update({ status: 'rejected' }).eq('id', appId);
  if (!res.error) {
    showToast('Application Rejected', 'The application has been rejected.', 'info');
    loadMatshwaneRoster();
  } else {
    showToast('Error', res.error.message, 'error');
  }
};

window.suspendMatshwaneMentor = async function(userId) {
  if (!confirm('Suspend this mentor?')) return;
  var res = await _db.from('profiles').update({ status: 'suspended' }).eq('id', userId);
  if (!res.error) {
    showToast('Mentor Suspended', 'The mentor account has been suspended.', 'warning');
    loadMatshwaneRoster();
  } else {
    showToast('Error', res.error.message, 'error');
  }
};

window.reinstateMatshwaneMentor = async function(userId) {
  if (!confirm('Reinstate this mentor?')) return;
  var res = await _db.from('profiles').update({ status: 'active' }).eq('id', userId);
  if (!res.error) {
    showToast('Mentor Reinstated', 'The mentor account is now active.', 'success');
    loadMatshwaneRoster();
  } else {
    showToast('Error', res.error.message, 'error');
  }
};

// ── Academic Verification Loader ──
async function loadMatshwaneEducation() {
  var table = document.getElementById('matshwane-edu-table');
  if (!table) return;
  table.innerHTML = '<tr><td colspan="7" class="empty-msg">Loading academic records...</td></tr>';

  var res = await _db.from('educational_records').select('*').order('created_at', { ascending: false });
  if (res.error) {
    res = await _db.from('educational_records').select('*');
  }

  if (res.error) {
    showToast('Error', res.error.message, 'error');
    table.innerHTML = '<tr><td colspan="7" class="empty-msg">Error loading academic records.</td></tr>';
    return;
  }

  var records = res.data || [];
  if (records.length === 0) {
    table.innerHTML = '<tr><td colspan="7" class="empty-msg">No academic records found for verification.</td></tr>';
    return;
  }

  table.innerHTML = '';
  records.forEach(function(rec) {
    var isVerified = rec.status === 'verified';
    var isRejected = rec.status === 'rejected';
    var statusPill = isVerified
      ? '<span class="status-pill active-pill">VERIFIED</span>'
      : isRejected
        ? '<span class="status-pill" style="background:#fee2e2;color:#dc2626;">REJECTED</span>'
        : '<span class="status-pill" style="background:#fef3c7;color:#d97706;">PENDING</span>';

    var docLink = rec.document_url
      ? '<a href="' + escAttr(rec.document_url) + '" target="_blank" style="color:var(--color-primary);font-weight:600;"><i data-lucide="external-link" style="width:13px;height:13px;"></i> View Doc</a>'
      : '<span style="color:var(--color-text-muted);">None</span>';

    var row = document.createElement('tr');
    row.innerHTML =
      '<td><strong>' + escHtml(rec.student_name || rec.student_id || 'Student') + '</strong></td>' +
      '<td>' + escHtml(rec.institution || '—') + '</td>' +
      '<td>' + escHtml(rec.qualification || rec.level || '—') + '</td>' +
      '<td>' + escHtml(rec.year || '—') + '</td>' +
      '<td>' + docLink + '</td>' +
      '<td>' + statusPill + '</td>' +
      '<td>' +
        (!isVerified && !isRejected ?
          '<button class="api-action-btn" style="color:#059669;margin-right:6px;" onclick="verifyMatshwaneEduRecord(\'' + rec.id + '\')">Verify</button>' +
          '<button class="api-action-btn" style="color:#dc2626;" onclick="rejectMatshwaneEduRecord(\'' + rec.id + '\')">Reject</button>'
          : '—') +
      '</td>';
    table.appendChild(row);
  });
  lucide.createIcons();
}

window.verifyMatshwaneEduRecord = async function(id) {
  if (!confirm('Verify and approve this academic record?')) return;
  var res = await _db.from('educational_records').update({ status: 'verified' }).eq('id', id);
  if (!res.error) {
    showToast('Record Verified', 'Academic record has been verified.', 'success');
    loadMatshwaneEducation();
  } else {
    showToast('Error', res.error.message, 'error');
  }
};

window.rejectMatshwaneEduRecord = async function(id) {
  if (!confirm('Reject this academic record?')) return;
  var res = await _db.from('educational_records').update({ status: 'rejected' }).eq('id', id);
  if (!res.error) {
    showToast('Record Rejected', 'Academic record has been rejected.', 'info');
    loadMatshwaneEducation();
  } else {
    showToast('Error', res.error.message, 'error');
  }
};

// ── Contracts & Compliance Loader ──
async function loadMatshwaneAgreements() {
  var table = document.getElementById('matshwane-agreements-table');
  if (!table) return;
  table.innerHTML = '<tr><td colspan="5" class="empty-msg">Loading mentor agreements...</td></tr>';

  var res = await _db.from('mentor_agreements').select('*').order('signed_at', { ascending: false });
  if (res.error) {
    res = await _db.from('mentor_agreements').select('*');
  }

  if (res.error) {
    showToast('Error', res.error.message, 'error');
    table.innerHTML = '<tr><td colspan="5" class="empty-msg">Error loading agreements.</td></tr>';
    return;
  }

  var list = res.data || [];
  if (list.length === 0) {
    table.innerHTML = '<tr><td colspan="5" class="empty-msg">No mentor agreements found.</td></tr>';
    return;
  }

  table.innerHTML = '';
  list.forEach(function(arg) {
    var signedDate = arg.signed_at ? new Date(arg.signed_at).toLocaleDateString() : 'N/A';
    var isApproved = arg.status === 'approved';
    var row = document.createElement('tr');
    row.innerHTML =
      '<td><strong>' + escHtml(arg.mentor_name || arg.mentor_id || 'Mentor') + '</strong></td>' +
      '<td>' + signedDate + '</td>' +
      '<td><span class="status-pill active-pill">v2026.1 GOVERNANCE</span></td>' +
      '<td><span class="status-pill ' + (isApproved ? 'active-pill' : '') + '">' + escHtml((arg.status || 'signed').toUpperCase()) + '</span></td>' +
      '<td>' +
        (!isApproved ?
          '<button class="api-action-btn" style="color:#059669;" onclick="approveMatshwaneAgreement(\'' + arg.id + '\')">Approve Contract</button>'
          : '✓ Fully Compliant') +
      '</td>';
    table.appendChild(row);
  });
  lucide.createIcons();
}

window.approveMatshwaneAgreement = async function(id) {
  if (!confirm('Approve this mentor contract package?')) return;
  var res = await _db.from('mentor_agreements').update({ status: 'approved' }).eq('id', id);
  if (!res.error) {
    showToast('Agreement Approved', 'Mentor contract package approved.', 'success');
    loadMatshwaneAgreements();
  } else {
    showToast('Error', res.error.message, 'error');
  }
};

// ── Audit Logs Loader ──
async function loadMatshwaneAudits() {
  var table = document.getElementById('matshwane-audits-table');
  if (!table) return;
  table.innerHTML = '<tr><td colspan="4" class="empty-msg">Loading audit logs...</td></tr>';

  var res = await _db.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(50);
  if (res.error) {
    res = await _db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
  }
  if (res.error) {
    res = await _db.from('audit_logs').select('*').limit(50);
  }

  if (res.error) {
    showToast('Error', res.error.message, 'error');
    table.innerHTML = '<tr><td colspan="4" class="empty-msg">Error loading audit logs.</td></tr>';
    return;
  }

  var logs = res.data || [];
  if (logs.length === 0) {
    table.innerHTML = '<tr><td colspan="4" class="empty-msg">No audit logs recorded yet.</td></tr>';
    return;
  }
  table.innerHTML = '';
  logs.forEach(function(log) {
    var logTime = log.timestamp || log.created_at;
    var row = document.createElement('tr');
    row.innerHTML =
      '<td>' + (logTime ? new Date(logTime).toLocaleString() : 'N/A') + '</td>' +
      '<td><strong>' + escHtml(log.user_id || 'SYSTEM') + '</strong></td>' +
      '<td>' + escHtml(log.action) + '</td>' +
      '<td><code style="font-size:11px;color:var(--color-primary);">' + escHtml(log.ip_address || '127.0.0.1') + '</code></td>';
    table.appendChild(row);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
lucide.createIcons();