import dns from 'dns'
dns.setDefaultResultOrder('ipv4first')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wjhuhaojygopjzqmdkqa.supabase.co',
      },
    ],
  },
};

export default nextConfig;
