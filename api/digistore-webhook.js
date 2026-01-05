// Endpoint da Notasy
const NOTASY_ENDPOINT = 'https://api-notasy.com.br/integrations/endpoint/019b8512-bb23-7078-9c40-77eea206c511';

// Mapeamento de transaction_type da Digistore para eventos da Notasy
const EVENT_MAP = {
  'payment': 'order_approved',
  'refund': 'order_refunded',
  'chargeback': 'order_refunded',
  'rebill_cancelled': 'order_refunded'
};

export default async function handler(req, res) {
  // Log para debug
  console.log('=== WEBHOOK RECEBIDO DA DIGISTORE24 ===');
  console.log('Method:', req.method);
  console.log('Query params:', req.query);
  console.log('Body:', req.body);

  // Aceitar GET ou POST (Digistore pode usar ambos)
  const digistore = req.method === 'POST' ? req.body : req.query;

  try {
    // Determinar o tipo de evento
    const transactionType = digistore.transaction_type || 'payment';
    const event = EVENT_MAP[transactionType] || 'order_approved';

    // Converter preço para centavos
    const amount = digistore.net_amount || digistore.gross_amount || '0';
    const priceInCents = Math.round(parseFloat(amount.replace(',', '.')) * 100);

    // Montar payload no formato Notasy
    const notasyPayload = {
      event: event,
      data: {
        sale: {
          id: digistore.order_id || digistore.transaction_id || 'unknown',
          paid_at: digistore.datetime_iso || new Date().toISOString()
        },
        items: [{
          product_id: digistore.product_id || 'unknown',
          offer_id: digistore.campaign_key || 'default',
          product_name: digistore.product_name || 'Produto',
          offer_name: digistore.campaign_key || 'Oferta padrão',
          price: priceInCents,
          currency: digistore.currency || 'BRL',
          quantity: 1
        }],
        customer: {
          name: `${digistore.buyer_first_name || ''} ${digistore.buyer_last_name || ''}`.trim() || 'Cliente',
          email: digistore.buyer_email || 'nao-informado@example.com'
        }
      }
    };

    // Adicionar participants se houver afiliado
    if (digistore.affiliate_id && digistore.affiliate_id !== digistore.vendor_id) {
      const affiliateAmount = digistore.affiliate_amount_unsigned || '0';
      const affiliateAmountCents = Math.round(parseFloat(affiliateAmount.replace(',', '.')) * 100);
      
      notasyPayload.data.participants = [
        {
          email: 'support@aventuresbibliques.com', // ALTERE AQUI COM SEU EMAIL
          amount: priceInCents - affiliateAmountCents
        },
        {
          email: digistore.affiliate_name || 'afiliado@example.com',
          amount: affiliateAmountCents
        }
      ];
    }

    console.log('=== ENVIANDO PARA NOTASY ===');
    console.log('Payload:', JSON.stringify(notasyPayload, null, 2));

    // Enviar para Notasy
    const notasyResponse = await fetch(NOTASY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notasyPayload)
    });

    const notasyResult = await notasyResponse.json().catch(() => ({}));

    console.log('=== RESPOSTA DA NOTASY ===');
    console.log('Status:', notasyResponse.status);
    console.log('Response:', notasyResult);

    // Retornar sucesso
    return res.status(200).json({
      success: true,
      message: 'Dados processados com sucesso',
      digistore_data: digistore,
      notasy_payload: notasyPayload,
      notasy_response: notasyResult
    });

  } catch (error) {
    console.error('=== ERRO NO PROCESSAMENTO ===');
    console.error(error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      digistore_data: digistore
    });
  }
}
