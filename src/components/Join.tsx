/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { supabase } from '../supabaseClient';

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

// Animated Section Component
const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  );
};

const Join: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    civility: '',
    fullname: '',
    email: '',
    phone: '',
    city: '',
    interest: '',
    skills: '',
    motivation: '',
    cv: null as File | null,
    captcha: false,
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [faqItems, setFaqItems] = useState<any[]>([]);
  const [contributionTypes, setContributionTypes] = useState<any[]>([]);

  useEffect(() => {
    const fetchFaqItems = async () => {
      const { data, error } = await supabase.from('faq').select('*');
      if (error) console.error('Error fetching FAQ items:', error);
      else setFaqItems(data as any[]);
    };

    const fetchContributionTypes = async () => {
      const { data, error } = await supabase.from('contribution_types').select('*');
      if (error) console.error('Error fetching contribution types:', error);
      else setContributionTypes(data as any[]);
    };

    fetchFaqItems();
    fetchContributionTypes();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({ ...prev, [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      alert('Format de fichier non supporté. Veuillez sélectionner un fichier PDF, DOC ou DOCX.');
      return;
    }

    if (file.size > maxSize) {
      alert('Le fichier est trop volumineux. La taille maximale autorisée est de 5MB.');
      return;
    }

    setFormData(prev => ({ ...prev, cv: file }));
    setUploadProgress(0);
  };

  const removeFile = () => {
    setFormData(prev => ({ ...prev, cv: null }));
    setUploadProgress(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Navigation entre les étapes
  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Validation des étapes
  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.civility && formData.fullname && formData.email && formData.phone && formData.city;
      case 2:
        return formData.interest && formData.skills && formData.motivation;
      case 3:
        return formData.captcha;
      default:
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Upload CV - Réactivé
    let cvUrl = null;
    if (formData.cv) {
      setUploadProgress(0);
      const fileExt = formData.cv.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      try {
        const { error: uploadError } = await supabase.storage
          .from('cv-uploads')
          .upload(fileName, formData.cv);
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        if (uploadError) {
          console.error('Error uploading CV:', uploadError);
          alert("Une erreur est survenue lors de l'upload de votre CV. Le formulaire sera soumis sans le CV.");
          setUploadProgress(0);
          // Continue sans le CV plutôt que d'arrêter
        } else {
          const { data } = supabase.storage.from('cv-uploads').getPublicUrl(fileName);
          cvUrl = data.publicUrl;
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert("Erreur d'upload. Le formulaire sera soumis sans le CV.");
        setUploadProgress(0);
      }
    }

    // Submit form data
    const { error } = await supabase.from('form_submissions').insert([{
      civility: formData.civility,
      fullname: formData.fullname,
      email: formData.email,
      phone: formData.phone,
      city: formData.city,
      interest: formData.interest,
      skills: formData.skills,
      motivation: formData.motivation,
      captcha: formData.captcha,
      cv_url: cvUrl
    }]);
    
    if (error) {
      console.error('Error submitting form:', error);
      alert("Une erreur est survenue lors de l'envoi de votre candidature.");
    } else {
      setShowModal(true);
      setFormData({ civility: '', fullname: '', email: '', phone: '', city: '', interest: '', skills: '', motivation: '', cv: null, captcha: false });
      setUploadProgress(0);
      setCurrentStep(1); // Reset to first step
    }
  };

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <section id="join" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-green-800 mb-4">Rejoignez-nous</motion.h2>
          <motion.div variants={itemVariants} className="w-24 h-1 bg-green-600 mx-auto"></motion.div>
        </AnimatedSection>

        <div className="flex flex-col lg:flex-row gap-12">
          <div className="lg:w-1/2 space-y-8">
            <AnimatedSection>
              <motion.h3 variants={itemVariants} className="text-2xl font-bold text-green-800 mb-6">Comment contribuer ?</motion.h3>
              <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {contributionTypes.map((type) => (
                  <motion.div key={type.id} variants={itemVariants} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-800 mb-4">
                      <i className={type.icon}></i>
                    </div>
                    <h4 className="text-lg font-bold text-green-800 mb-2">{type.title}</h4>
                    <p className="text-gray-700">{type.description}</p>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatedSection>

            <AnimatedSection className="bg-white p-6 rounded-lg shadow-sm">
              <motion.h4 variants={itemVariants} className="text-lg font-bold text-green-800 mb-4">FAQ</motion.h4>
              <motion.div variants={containerVariants} className="space-y-4">
                {faqItems.map((item, index) => (
                  <motion.div key={item.id} variants={itemVariants}>
                    <button onClick={() => toggleFAQ(index)} className="w-full flex justify-between items-center text-left font-medium text-green-800">
                      <span>{item.question}</span>
                      <i className={`fas fa-chevron-down transition-transform ${openFAQ === index ? 'transform rotate-180' : ''}`}></i>
                    </button>
                    {openFAQ === index && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 pl-4 text-gray-700 border-l-2 border-green-200 overflow-hidden">
                        <p>{item.answer}</p>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            </AnimatedSection>
          </div>

          <AnimatedSection className="lg:w-1/2 bg-white p-8 rounded-lg shadow-md">
            <motion.h3 variants={itemVariants} className="text-2xl font-bold text-green-800 mb-6">Devenez membre</motion.h3>
            
            {/* Indicateur de progression */}
            <motion.div variants={itemVariants} className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className={`flex items-center ${currentStep >= 1 ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    1
                  </div>
                  <span className="ml-2 text-sm font-medium">Informations personnelles</span>
                </div>
                <div className={`flex items-center ${currentStep >= 2 ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep >= 2 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    2
                  </div>
                  <span className="ml-2 text-sm font-medium">Profil & motivation</span>
                </div>
                <div className={`flex items-center ${currentStep >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    3
                  </div>
                  <span className="ml-2 text-sm font-medium">Finalisation</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                ></div>
              </div>
            </motion.div>

            <motion.form onSubmit={handleSubmit} variants={containerVariants} className="space-y-4">
              
              {/* Étape 1: Informations personnelles */}
              {currentStep === 1 && (
                <motion.div variants={itemVariants} className="space-y-4">
                  <h4 className="text-lg font-semibold text-green-800 mb-4">Informations personnelles</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="civility" className="block text-gray-700 font-medium mb-2">Civilité</label>
                      <select id="civility" value={formData.civility} onChange={handleInputChange} className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600">
                        <option value="">Sélectionnez</option>
                        <option value="M">Monsieur</option>
                        <option value="Mme">Madame</option>
                        <option value="Mlle">Mademoiselle</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="fullname" className="block text-gray-700 font-medium mb-2">Nom complet</label>
                      <input type="text" id="fullname" value={formData.fullname} onChange={handleInputChange} required className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600" />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-gray-700 font-medium mb-2">Adresse e-mail</label>
                    <input type="email" id="email" value={formData.email} onChange={handleInputChange} required className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-gray-700 font-medium mb-2">Téléphone</label>
                    <input type="tel" id="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  
                  <div>
                    <label htmlFor="city" className="block text-gray-700 font-medium mb-2">Ville</label>
                    <input type="text" id="city" value={formData.city} onChange={handleInputChange} className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </motion.div>
              )}

              {/* Étape 2: Profil & motivation */}
              {currentStep === 2 && (
                <motion.div variants={itemVariants} className="space-y-4">
                  <h4 className="text-lg font-semibold text-green-800 mb-4">Profil & motivation</h4>
                  
                  <div>
                    <label htmlFor="interest" className="block text-gray-700 font-medium mb-2">Domaine d'intérêt</label>
                    <input type="text" id="interest" value={formData.interest} onChange={handleInputChange} placeholder="Décrivez votre domaine d'intérêt" className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  
                  <div>
                    <label htmlFor="skills" className="block text-gray-700 font-medium mb-2">Compétences <span className="text-red-500">*</span></label>
                    <textarea id="skills" rows={3} value={formData.skills} onChange={handleInputChange} required placeholder="Décrivez vos compétences et expériences" className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"></textarea>
                  </div>
                  
                  <div>
                    <label htmlFor="motivation" className="block text-gray-700 font-medium mb-2">Pourquoi souhaitez-vous nous rejoindre ?</label>
                    <textarea id="motivation" rows={4} value={formData.motivation} onChange={handleInputChange} placeholder="Expliquez votre motivation pour rejoindre l'ONG DDB" className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600"></textarea>
                  </div>
                </motion.div>
              )}

              {/* Étape 3: Finalisation */}
              {currentStep === 3 && (
                <motion.div variants={itemVariants} className="space-y-4">
                  <h4 className="text-lg font-semibold text-green-800 mb-4">Finalisation</h4>
                  
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">CV (PDF, DOC, DOCX) - Max 5MB</label>
                    
                    {/* Zone de drop moderne */}
                    <div
                      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${
                        isDragOver
                          ? 'border-green-500 bg-green-50'
                          : formData.cv
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        id="cv"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      
                      {formData.cv ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                              <i className="fas fa-file-pdf text-green-600 text-xl"></i>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{formData.cv.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(formData.cv.size)}</p>
                          </div>
                          
                          {/* Barre de progression */}
                          {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              ></div>
                            </div>
                          )}
                          
                          {/* Statut d'upload */}
                          {uploadProgress === 100 && (
                            <div className="flex items-center justify-center text-green-600">
                              <i className="fas fa-check-circle mr-2"></i>
                              <span className="text-sm font-medium">Upload terminé</span>
                            </div>
                          )}
                          
                          <button
                            type="button"
                            onClick={removeFile}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            <i className="fas fa-trash mr-1"></i>
                            Supprimer
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                              <i className="fas fa-cloud-upload-alt text-gray-400 text-xl"></i>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Glissez-déposez votre CV ici
                            </p>
                            <p className="text-xs text-gray-500">
                              ou cliquez pour sélectionner un fichier
                            </p>
                          </div>
                          <div className="flex items-center justify-center space-x-4 text-xs text-gray-400">
                            <span className="flex items-center">
                              <i className="fas fa-file-pdf mr-1"></i>
                              PDF
                            </span>
                            <span className="flex items-center">
                              <i className="fas fa-file-word mr-1"></i>
                              DOC
                            </span>
                            <span className="flex items-center">
                              <i className="fas fa-file-word mr-1"></i>
                              DOCX
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <input type="checkbox" id="captcha" checked={formData.captcha} onChange={handleInputChange} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                    <label htmlFor="captcha" className="ml-2 block text-gray-700">Je ne suis pas un robot</label>
                  </div>
                </motion.div>
              )}

              {/* Boutons de navigation */}
              <motion.div variants={itemVariants} className="flex justify-between pt-6">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="btn btn-outline bg-white hover:bg-gray-50 text-green-800 border border-green-800 font-bold py-2 px-6 rounded"
                  >
                    <i className="fas fa-arrow-left mr-2"></i>
                    Précédent
                  </button>
                )}
                
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!isStepValid(currentStep)}
                    className="btn btn-primary btn-enhanced text-white font-bold py-2 px-6 rounded disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                  >
                    Suivant
                    <i className="fas fa-arrow-right ml-2"></i>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!isStepValid(currentStep)}
                    className="btn btn-primary btn-enhanced pulse-on-hover text-white font-bold py-2 px-6 rounded disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                  >
                    <i className="fas fa-paper-plane mr-2"></i>
                    Envoyer ma candidature
                  </button>
                )}
              </motion.div>
            </motion.form>
            {showSuccess && (
              <div className="mt-4 p-4 bg-green-100 text-green-800 rounded">
                <i className="fas fa-check-circle mr-2"></i>
                Merci ! Votre demande a bien été envoyée. Nous vous contacterons rapidement.
              </div>
            )}
          </AnimatedSection>
        </div>

        {/* Modal de confirmation */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-check text-green-600 text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Candidature envoyée !</h3>
                <p className="text-gray-600 mb-6">
                  Merci pour votre intérêt à rejoindre l'ONG DDB. Votre candidature a été transmise avec succès à notre équipe.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-green-800 mb-2">Prochaines étapes :</h4>
                  <ul className="text-sm text-green-700 text-left space-y-1">
                    <li>• Nous examinerons votre candidature</li>
                    {/* <li>• Vous recevrez un email de confirmation</li> */}
                    <li>• Notre équipe vous contactera très bientôt !</li>
                  </ul>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="btn btn-primary btn-enhanced text-white font-bold py-2 px-6 rounded w-full"
                >
                  <i className="fas fa-thumbs-up mr-2"></i>
                  Parfait !
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Join;