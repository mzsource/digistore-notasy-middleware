// Converter preço para centavos
const amount = digistore.net_amount || digistore.gross_amount || '0';
const priceInCents = Math.round(parseFloat(amount.replace(',', '.')) * 100);

// Extrair país do comprador (se disponível)
const country = digistore.country || 'BR';

// Definir documento baseado no país
let document = {};
if (country === 'BR' || country === 'Brazil') {
  // Para Brasil: usar CPF genérico (você pode pedir pro cliente informar depois)
  document = { cpf: '00000000000' }; // CPF fictício - ALTERE conforme necessário
} else {
  // Para outros países: documento internacional
  document = { 
    international_document: digistore.buyer_email || 'N/A'
  };
}

// Montar payload no formato Notasy COM TODOS OS CAMPOS OBRIGATÓRIOS
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
      email: digistore.buyer_email || 'nao-informado@example.com',
      
      // DOCUMENTO OBRIGATÓRIO
      ...document,
      
      // ENDEREÇO OBRIGATÓRIO
      address: {
        zipcode: '00000000', // CEP fictício - idealmente coletar do cliente
        uf: 'SP', // Estado fictício
        city: 'São Paulo', // Cidade fictícia
        district: 'Centro', // Bairro fictício
        address: 'Rua Exemplo', // Rua fictícia
        address_number: 'S/N', // Número fictício
        address_complement: '' // Complemento opcional
      }
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
  notasy_response: notasyResult,
  notasy_status: notasyResponse.status
});
