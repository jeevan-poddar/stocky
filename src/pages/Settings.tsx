import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Store, MapPin, Bell, Save, Loader2 } from 'lucide-react';

interface SettingsForm {
  shop_name: string;
  owner_name: string;
  phone: string;
  city: string;
  state: string;
  expiry_threshold_days: number;
}

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState<SettingsForm>({
    shop_name: '',
    owner_name: '',
    phone: '',
    city: '',
    state: '',
    expiry_threshold_days: 60,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No user found');
      }
      
      setUserId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .single();

      if (error) {
          console.error('Error fetching profile:', error);
      }

      if (data) {
        setFormData({
          shop_name: data.shop_name || '',
          owner_name: data.owner_name || '',
          phone: data.phone || '',
          city: data.city || '',
          state: data.state || '',
          expiry_threshold_days: data.expiry_threshold_days || 60,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'expiry_threshold_days' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // Validation
    if (!formData.phone.trim()) {
      setMessage({ type: 'error', text: 'Phone number is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          shop_name: formData.shop_name,
          owner_name: formData.owner_name,
          phone: formData.phone,
          city: formData.city,
          state: formData.state,
          expiry_threshold_days: formData.expiry_threshold_days,
        })
        .eq('id', userId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settings updated successfully' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your shop profile and application preferences</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Shop Identity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Shop Identity</h2>
              <p className="text-sm text-gray-500">Details that appear on your bills</p>
            </div>
          </div>
          <div className="p-6 grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Shop Name</label>
              <input
                type="text"
                name="shop_name"
                value={formData.shop_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                placeholder="e.g. HealthPlus Pharmacy"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Owner Name</label>
              <input
                type="text"
                name="owner_name"
                value={formData.owner_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                placeholder="e.g. +91 98765 43210"
                required
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Location</h2>
              <p className="text-sm text-gray-500">Your shop's address details</p>
            </div>
          </div>
          <div className="p-6 grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                placeholder="e.g. Mumbai"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                placeholder="e.g. Maharashtra"
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Preferences</h2>
              <p className="text-sm text-gray-500">Customize your app experience</p>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-2 max-w-md">
              <label className="text-sm font-medium text-gray-700">Expiry Alert Threshold (Days)</label>
              <div className="relative">
                <input
                  type="number"
                  name="expiry_threshold_days"
                  value={formData.expiry_threshold_days}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
                <span className="absolute right-4 top-2.5 text-sm text-gray-400">days</span>
              </div>
              <p className="text-xs text-gray-500">
                You will be warned when medicines are expiring within this many days.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className={`
              flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium
              hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-all
              ${saving ? 'opacity-70 cursor-not-allowed' : ''}
            `}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Settings;
