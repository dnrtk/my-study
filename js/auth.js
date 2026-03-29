(function () {
  // TODO: Replace with your Supabase project credentials
  var SUPABASE_URL = 'https://rxzpknwoqpvxzjtkwisu.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4enBrbndvcXB2eHpqdGt3aXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTg1NTAsImV4cCI6MjA5MDMzNDU1MH0.40ce-OYqOClHxVajSDB5MFTb4pNHYMMcJao9EEMBiiQ';

  /** @type {import('@supabase/supabase-js').SupabaseClient | null} */
  var client = null;

  function initSupabase() {
    if (!client) {
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  function getClient() {
    return client;
  }

  /** @returns {Promise<void>} */
  async function signIn() {
    var { error } = await client.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) {
      App.Utils.showToast('Login failed: ' + error.message);
    }
  }

  /** @returns {Promise<void>} */
  async function signOut() {
    var { error } = await client.auth.signOut();
    if (error) {
      App.Utils.showToast('Logout failed: ' + error.message);
    }
  }

  /** @returns {Promise<Object|null>} */
  async function getUser() {
    var { data } = await client.auth.getUser();
    return data.user;
  }

  /** @returns {Promise<Object|null>} */
  async function getSession() {
    var { data } = await client.auth.getSession();
    return data.session;
  }

  /**
   * @param {(event: string, session: Object|null) => void} callback
   */
  function onAuthChange(callback) {
    client.auth.onAuthStateChange(callback);
  }

  window.App = window.App || {};
  window.App.Auth = {
    initSupabase: initSupabase,
    getClient: getClient,
    signIn: signIn,
    signOut: signOut,
    getUser: getUser,
    getSession: getSession,
    onAuthChange: onAuthChange,
  };
})();
