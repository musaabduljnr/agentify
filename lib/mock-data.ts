export const stats = [
  { label: "Total Conversations", value: "1,284", change: "+12%", changeType: "positive" },
  { label: "Leads Captured", value: "482", change: "+8%", changeType: "positive" },
  { label: "Message Usage", value: "84%", change: "12,482 / 15,000", changeType: "neutral" },
  { label: "Assistant Status", value: "Active", change: "Online", changeType: "positive" },
];

export const recentConversations = [
  { id: "1", visitor: "John Doe", lastMessage: "How can I integrate this?", time: "2m ago", status: "Lead" },
  { id: "2", visitor: "Anonymous #482", lastMessage: "Pricing details please.", time: "15m ago", status: "Visitor" },
  { id: "3", visitor: "Sarah Smith", lastMessage: "Thank you for the help!", time: "1h ago", status: "Lead" },
  { id: "4", visitor: "Anonymous #481", lastMessage: "Is there a free trial?", time: "2h ago", status: "Visitor" },
  { id: "5", visitor: "Mike Johnson", lastMessage: "I need support with my widget.", time: "3h ago", status: "Visitor" },
];

export const popularQuestions = [
  { question: "How much does it cost?", count: 145 },
  { question: "How to install the widget?", count: 98 },
  { question: "Can I customize the colors?", count: 76 },
  { question: "Does it support multiple languages?", count: 54 },
];

export const setupChecklist = [
  { id: "1", task: "Create your assistant", completed: true },
  { id: "2", task: "Add knowledge base", completed: true },
  { id: "3", task: "Customize widget", completed: false },
  { id: "4", task: "Install embed code", completed: false },
];

export const leads = [
  { id: "1", name: "John Doe", email: "john@example.com", phone: "+1 234 567 890", interest: "High", source: "Website", status: "New" },
  { id: "2", name: "Sarah Smith", email: "sarah@company.com", phone: "+1 987 654 321", interest: "Medium", source: "Landing Page", status: "Contacted" },
  { id: "3", name: "Mike Johnson", email: "mike@agency.io", phone: "+1 555 000 111", interest: "High", source: "Referral", status: "Qualified" },
  { id: "4", name: "Emily Brown", email: "emily@tech.com", phone: "+1 444 333 222", interest: "Low", source: "Website", status: "Closed" },
];

export const knowledgeSources = [
  { id: "1", name: "https://agentify.ai/docs", type: "URL", status: "Trained", lastUpdated: "2 hours ago" },
  { id: "2", name: "business_info.pdf", type: "Document", status: "Trained", lastUpdated: "1 day ago" },
  { id: "3", name: "Pricing FAQ", type: "Manual", status: "Processing", lastUpdated: "Just now" },
  { id: "4", name: "https://agentify.ai/blog", type: "URL", status: "Failed", lastUpdated: "3 hours ago" },
];
