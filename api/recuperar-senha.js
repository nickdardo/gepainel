// API Serverless para Recuperação de Senha
// Este arquivo deve estar em: api/recuperar-senha.js

export default async function handler(req, res) {
  // Apenas aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { login } = req.body;

    if (!login) {
      return res.status(400).json({ error: 'Login ou e-mail é obrigatório' });
    }

    // API Key do Resend (virá das variáveis de ambiente)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY não configurada');
      return res.status(500).json({ error: 'Servidor não configurado' });
    }

    // Conectar ao Supabase
    const SUPA_URL = 'https://abmwlhxdvfgnptmvtkla.supabase.co';
    const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibXdsaHhkdmZnbnB0bXZ0a2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjU2NzQsImV4cCI6MjA5MTU0MTY3NH0.rHxMXklvuy1uktseEWAkPRp4cdvVlzl_mx97fAvKZY0';

    // Buscar usuário por login
    let userResponse = await fetch(
      `${SUPA_URL}/rest/v1/users?login=eq.${login.toLowerCase()}&select=id,nome,login,email`,
      {
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
        }
      }
    );

    let userData = await userResponse.json();
    let user = userData[0];

    // Se não encontrou por login, tenta por email
    if (!user) {
      userResponse = await fetch(
        `${SUPA_URL}/rest/v1/users?email=eq.${login.toLowerCase()}&select=id,nome,login,email`,
        {
          headers: {
            'apikey': SUPA_KEY,
            'Authorization': `Bearer ${SUPA_KEY}`,
          }
        }
      );
      userData = await userResponse.json();
      user = userData[0];
    }

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (!user.email) {
      return res.status(400).json({ error: 'Este usuário não possui e-mail cadastrado' });
    }

    // Gerar senha temporária (6 caracteres)
    const senhaTemp = Math.random().toString(36).slice(2, 8).toUpperCase();

    // Hash da senha (mesmo algoritmo do frontend)
    function hashPassword(s) {
      let h = 0;
      for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
      }
      return h.toString(36);
    }

    const passHash = hashPassword(senhaTemp);

    // Atualizar senha no banco
    const updateResponse = await fetch(
      `${SUPA_URL}/rest/v1/users?id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ pass_hash: passHash })
      }
    );

    if (!updateResponse.ok) {
      throw new Error('Erro ao atualizar senha');
    }

    // Enviar e-mail via Resend
    const emailData = {
      from: 'GEPainel <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Recuperação de Senha - GEPainel',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#EA580C">Recuperação de Senha</h2>
          <p>Olá, <strong>${user.nome}</strong>!</p>
          <p>Você solicitou a recuperação de senha para sua conta no GEPainel.</p>
          <div style="background:#F3F4F6;padding:15px;border-radius:8px;margin:20px 0">
            <p style="margin:0;font-size:14px;color:#666">Sua senha temporária é:</p>
            <p style="margin:10px 0 0;font-size:24px;font-weight:bold;color:#EA580C;letter-spacing:2px">${senhaTemp}</p>
          </div>
          <p><strong>Login:</strong> ${user.login}</p>
          <p style="color:#666;font-size:14px">Por segurança, recomendamos que você altere esta senha após fazer login.</p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:30px 0"/>
          <p style="color:#999;font-size:12px">Se você não solicitou esta recuperação, ignore este e-mail.</p>
        </div>
      `
    };

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('Erro Resend:', errorData);
      throw new Error('Erro ao enviar e-mail');
    }

    // Sucesso!
    return res.status(200).json({ 
      success: true, 
      message: 'Senha enviada para ' + user.email 
    });

  } catch (error) {
    console.error('Erro na API:', error);
    return res.status(500).json({ error: 'Erro ao processar solicitação' });
  }
}
