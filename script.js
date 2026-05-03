<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>
  <script>

    const supabaseClient = supabase.createClient(
      "https://cjylqadgpvaqsupuhpmw.supabase.co",
      "sb_publishable_lfZcEvPxxwZAudioOD8ISQ_-ID66HYi"
    );

    let currentUser = null;

    window.addEventListener('DOMContentLoaded', async () => {
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('visit_date').value = today;

      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        currentUser = session.user;
        showApp(session.user.email);
        await loadPointsAndCheckCooldown(session.user.id);
      }
    });

    let currentTab = 'login';
    function switchTab(tab) {
      currentTab = tab;
      document.getElementById('tab-login').classList.toggle('active', tab === 'login');
      document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
      document.getElementById('auth-btn').textContent = tab === 'login' ? 'Log In' : 'Sign Up';
      document.getElementById('auth-message').textContent = '';
    }

    async function handleAuth() {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const msgEl = document.getElementById('auth-message');
      msgEl.classList.remove('success');
      msgEl.textContent = '';

      if (!email || !password) {
        msgEl.textContent = 'Please enter your email and password.';
        return;
      }

      if (currentTab === 'login') {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          msgEl.textContent = 'Login failed: ' + error.message;
        } else {
          currentUser = data.user;
          showApp(data.user.email);
          await loadPointsAndCheckCooldown(data.user.id);
        }
      } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
          msgEl.textContent = 'Sign up failed: ' + error.message;
        } else {
          await supabaseClient.from('profiles').insert([{
            id: data.user.id,
            points: 0,
            last_review_at: null
          }]);
          msgEl.classList.add('success');
          msgEl.textContent = 'Account created! Check your email to confirm, then log in.';
        }
      }
    }

    function showApp(email) {
      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('app-screen').style.display = 'flex';
      document.getElementById('user-email-display').textContent = email;
    }

    async function loadPointsAndCheckCooldown(userId) {
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('points, last_review_at')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        await supabaseClient.from('profiles').insert([{ id: userId, points: 0, last_review_at: null }]);
        updatePointsUI(0);
        return;
      }

      updatePointsUI(profile.points || 0);

      if (profile.last_review_at) {
        const lastReview = new Date(profile.last_review_at);
        const now = new Date();
        const hoursSince = (now - lastReview) / (1000 * 60 * 60);

        if (hoursSince < 8){
          document.getElementById('cooldown-notice').style.display = 'block';
          document.getElementById('submit-btn').disabled = true;
        }
      }
    }

    function updatePointsUI(points) {
      document.getElementById('points-num').textContent = points;
      document.getElementById('points-bar').style.width = (points / 3 * 100) + '%';

      if (points >= 3) {
        document.getElementById('points-progress-card').style.display = 'none';
        document.getElementById('redeem-card').style.display = 'block';
        document.getElementById('submit-btn').disabled = true;
      }
    }

    async function redeemCookie() {
      if (!currentUser) return;

      const confirmed = confirm("Did the barista see your screen? Tap OK to redeem your free cookie! 🍪");
      if (!confirmed) return;

      await supabaseClient.from('redemptions').insert([{
        user_id: currentUser.id,
        redeemed_at: new Date().toISOString()
      }]);

      await supabaseClient
        .from('profiles')
        .update({ points: 0 })
        .eq('id', currentUser.id);

      document.getElementById('redeem-card').style.display = 'none';
      document.getElementById('points-progress-card').style.display = 'flex';
      document.getElementById('submit-btn').disabled = false;
      updatePointsUI(0);

      alert("Enjoy your cookie! ☕🍪 Keep reviewing to earn another one!");
    }

    async function handleLogout() {
      await supabaseClient.auth.signOut();
      currentUser = null;
      document.getElementById('app-screen').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-password').value = '';
      document.getElementById('cooldown-notice').style.display = 'none';
      document.getElementById('submit-btn').disabled = false;
    }

    const nameInput = document.getElementById('name');
    const anonBtn = document.getElementById('anon-toggle');
    anonBtn.addEventListener('click', function () {
      if (this.classList.contains('active')) {
        this.classList.remove('active');
        nameInput.disabled = false;
        nameInput.value = '';
      } else {
        this.classList.add('active');
        nameInput.value = 'Anonymous';
        nameInput.disabled = true;
      }
    });

    const form = document.getElementById('TommyRev');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!currentUser) return;

      const submitBtn = document.getElementById('submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      const reviewData = {
        user_id: currentUser.id,
        name: nameInput.value || "Anonymous",
        visit_date: document.getElementById('visit_date').value,
        staff_rating: document.querySelector('input[name="staff_rating"]:checked')?.value,
        staff_comment: document.getElementById('staff_comment').value,
        drinks_rating: document.querySelector('input[name="drinks_rating"]:checked')?.value,
        drinks_ordered: document.getElementById('drinks_ordered').value,
        drinks_comment: document.getElementById('drinks_comment').value,
        ambience_rating: document.querySelector('input[name="ambience_rating"]:checked')?.value,
        ambience_comment: document.getElementById('ambience_comment').value,
        overall: document.getElementById('overall').value,
        recommend_group: document.querySelector('input[name="would_recommend"]:checked')?.value
      };

      const { error: reviewError } = await supabaseClient.from("TommyRev").insert([reviewData]);

      if (reviewError) {
        alert("Error submitting review. Please try again.");
        console.error(reviewError);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
        return;
      }

      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('points')
        .eq('id', currentUser.id)
        .single();

      const newPoints = Math.min((profile?.points || 0) + 1, 3);

      await supabaseClient
        .from('profiles')
        .update({ points: newPoints, last_review_at: new Date().toISOString() })
        .eq('id', currentUser.id);

      window.location.href = "thank-you.html";
    });

  </script>