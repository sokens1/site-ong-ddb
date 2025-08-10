/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const Join: React.FC = () => {
  const [formData, setFormData] = useState({
    civility: '',
    fullname: '',
    email: '',
    phone: '',
    city: '',
    interest: '',
    skills: '',
    motivation: '',
    captcha: false // correspond au nom de la colonne dans Supabase
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [faqItems, setFaqItems] = useState<any[]>([]);
  const [contributionTypes, setContributionTypes] = useState<any[]>([]);

  useEffect(() => {
    const fetchFaqItems = async () => {
      const { data, error } = await supabase.from('faq').select('*');
      if (error) {
        console.error('Error fetching FAQ items:', error);
        return;
      }
      setFaqItems(data as any[]);
    };

    const fetchContributionTypes = async () => {
      const { data, error } = await supabase.from('contribution_types').select('*');
      if (error) {
        console.error('Error fetching contribution types:', error);
        return;
      }
      setContributionTypes(data as any[]);
    };

    fetchFaqItems();
    fetchContributionTypes();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('form_submissions')
      .insert([formData]);

    if (error) {
      console.error('Error submitting form:', error);
      alert('Une erreur est survenue lors de l\'envoi de votre candidature.');
    } else {
    setShowSuccess(true);
    setFormData({
      civility: '',
      fullname: '',
      email: '',
      phone: '',
      city: '',
      interest: '',
      skills: '',
      motivation: '',
      captcha: false
    });
    setTimeout(() => setShowSuccess(false), 5000);
    }
  };

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <section id="join" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Rejoignez-nous</h2>
          <div className="w-24 h-1 bg-green-600 mx-auto"></div>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          <div className="lg:w-1/2">
            <h3 className="text-2xl font-bold text-green-800 mb-6">Comment contribuer ?</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {contributionTypes.map((type, index) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-800 mb-4">
                    <i className={type.icon}></i>
                  </div>
                  <h4 className="text-lg font-bold text-green-800 mb-2">{type.title}</h4>
                  <p className="text-gray-700">{type.description}</p>
                </div>
              ))}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h4 className="text-lg font-bold text-green-800 mb-4">FAQ</h4>
              <div className="space-y-4">
                {faqItems.map((item, index) => (
                  <div key={index}>
                    <button
                      onClick={() => toggleFAQ(index)}
                      className="flex justify-between items-center w-full text-left font-medium text-green-800"
                    >
                      <span>{item.question}</span>
                      <i className={`fas ${openFAQ === index ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                    </button>
                    {openFAQ === index && (
                      <div className="mt-2 text-gray-700">
                        <p>{item.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:w-1/2">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-2xl font-bold text-green-800 mb-6">Formulaire d'engagement</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="civility" className="block text-gray-700 font-medium mb-2">
                      Civilité
                    </label>
                    <select
                      id="civility"
                      value={formData.civility}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      <option value="">Sélectionnez</option>
                      <option value="M">Monsieur</option>
                      <option value="Mme">Madame</option>
                      <option value="Mlle">Mademoiselle</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="fullname" className="block text-gray-700 font-medium mb-2">
                      Nom complet
                    </label>
                    <input
                      type="text"
                      id="fullname"
                      value={formData.fullname}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-gray-700 font-medium mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="city" className="block text-gray-700 font-medium mb-2">
                    Ville
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                <div>
                  <label htmlFor="interest" className="block text-gray-700 font-medium mb-2">
                    Domaine d'intérêt
                  </label>
                  <select
                    id="interest"
                    value={formData.interest}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"
                  >
                    <option value="">Sélectionnez un domaine</option>
                    <option value="education">Éducation environnementale</option>
                    <option value="cleaning">Nettoyage d'espaces naturels</option>
                    <option value="restoration">Restauration d'écosystèmes</option>
                    <option value="events">Organisation d'événements</option>
                    <option value="communication">Communication et réseaux sociaux</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="skills" className="block text-gray-700 font-medium mb-2">
                    Compétences (facultatif)
                  </label>
                  <textarea
                    id="skills"
                    rows={2}
                    value={formData.skills}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="motivation" className="block text-gray-700 font-medium mb-2">
                    Pourquoi souhaitez-vous nous rejoindre ?
                  </label>
                  <textarea
                    id="motivation"
                    rows={3}
                    value={formData.motivation}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"
                  ></textarea>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="captcha"
                    checked={formData.captcha}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="captcha" className="ml-2 block text-gray-700">
                    Je ne suis pas un robot
                  </label>
                </div>
                <div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-enhanced pulse-on-hover w-full text-white font-bold py-3 px-4 rounded"
                  >
                    Envoyer ma candidature
                  </button>
                </div>
              </form>
              {showSuccess && (
                <div className="mt-4 p-4 bg-green-100 text-green-800 rounded">
                  <i className="fas fa-check-circle mr-2"></i>
                  Merci ! Votre demande a bien été envoyée. Nous vous contacterons rapidement.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Join;