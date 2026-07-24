import re

with open(r'app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Strip IIFE wrapper: (function() { ... })();
code = code.strip()
if code.startswith('(function() {'):
    code = code[len('(function() {'):].strip()
if code.endswith('})();'):
    code = code[:-len('})();')].strip()

# Replace the supabase client init to use a safe internal name _sb
code = code.replace(
    'const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);',
    'const _sb = window.supabase.createClient(supabaseUrl, supabaseAnonKey);'
)

# Replace all .supabase. usages (method calls on the client) with ._sb.
# But we must NOT rename supabaseUrl or supabaseAnonKey
code = re.sub(r'\bsupabase\.', '_sb.', code)

# Restore supabaseUrl and supabaseAnonKey declarations (they won't match \bsupabase\. pattern so they're fine)
# But just in case, double check
assert 'const supabaseUrl' in code, 'supabaseUrl missing!'
assert 'const supabaseAnonKey' in code, 'supabaseAnonKey missing!'
assert '_sb.auth' in code, '_sb.auth missing!'
assert '_sb.from' in code, '_sb.from missing!'

print('supabaseUrl OK:', 'const supabaseUrl' in code)
print('_sb.auth OK:', '_sb.auth' in code)
print('_sb.from OK:', '_sb.from' in code)
print('Total lines:', code.count('\n'))
print('First 300:', code[:300])

with open(r'app.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(code)

print('Done - app.js fixed!')
