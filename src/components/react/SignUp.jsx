// src/components/MyForm.jsx
import React, { useState } from 'react';

const SignUp = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    investedInCrypto: false,
    preferredBlockchain: '',
    otherBlockchain: '', 
    ethereumAddress: '',
  });

  const blockchainOptions = [
    'Bitcoin',
    'Ethereum',
    'Binance Smart Chain',
    'Cardano',
    'Solana',
    'Polkadot',
    'Avalanche',
    'Internet Computer Protocol',
    'Polygon',
    'Fantom',
    'TON',
    'Algorand',
    'Tezos',
    'Cosmos',
    'MutiversX',
    'Sei',
    'Aptos',
    'Sui',
    'XRP',
    'NEAR Protocol',
    'Kaspa',
    'Hedera',
    'Arbitrum',
    'Base',
    'Starknet',
    'Other'
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Mock for sending form data to API endpoint
    console.log(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-6 bg-white shadow-md rounded-md">
      <div className="mb-4">
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name:</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email:</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone #:</label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="mb-4 flex items-center">
        <label htmlFor="investedInCrypto" className="block text-sm font-medium text-gray-700 mr-3">Invested In Crypto:</label>
        <input
          type="checkbox"
          id="investedInCrypto"
          name="investedInCrypto"
          checked={formData.investedInCrypto}
          onChange={handleChange}
          required
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="preferredBlockchain" className="block text-sm font-medium text-gray-700">Preferred Blockchain:</label>
        <select
          id="preferredBlockchain"
          name="preferredBlockchain"
          value={formData.preferredBlockchain}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="" disabled>Select your preferred blockchain</option>
            {blockchainOptions.map((blockchain) => (
                <option key={blockchain} value={blockchain}>
                  {blockchain}
                </option>
              ))}
        </select>
      </div>

      {formData.preferredBlockchain == 'Other' && (
        <div className="mb-4">
          <label htmlFor="otherBlockchain" className="block text-sm font-medium text-gray-700">Specify Blockchain:</label>
          <input
            type="text"
            id="otherBlockchain"
            name="otherBlockchain"
            value={formData.otherBlockchain}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="ethereumAddress" className="block text-sm font-medium text-gray-700">Ethereum Address (optional):</label>
        <input
          type="text"
          id="ethereumAddress"
          name="ethereumAddress"
          value={formData.ethereumAddress}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
        Submit
      </button>
    </form>
  );
};

export default SignUp;