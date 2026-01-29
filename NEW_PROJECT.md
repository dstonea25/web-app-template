# Starting a New Project from This Template

## Step 1: Create a Local Copy

### Option A: Clone from GitHub (Recommended)
```bash
# Clone the template to a new folder
git clone https://github.com/dstonea25/web-app-template.git my-new-app

# Navigate into it
cd my-new-app

# Remove the git history (start fresh)
rm -rf .git

# Initialize as a new repo
git init
```

### Option B: Copy Local Folder
```bash
# Copy the template folder
cp -r /path/to/web-app-template /path/to/my-new-app

# Navigate into it
cd my-new-app

# Remove the git history (start fresh)
rm -rf .git

# Initialize as a new repo
git init
```

---

## Step 2: Open in Cursor

Open the new folder in Cursor:
```bash
cursor my-new-app
```

Or: File → Open Folder → select your new app folder

---

## Step 3: Use This Initial Prompt

Copy and paste this into the Cursor chat:

```
I want to create a new app from this template. 

Please read AGENT.md to understand the template structure and onboarding process, then ask me the required questions to set everything up:
- App name and description
- My email and password for the admin account  
- Any preferences (region, colors)

After I answer, please:
1. Create a new Supabase project via MCP
2. Run the database migrations
3. Create my user account
4. Update the app config with my app name
5. Create a new GitHub repo and push the initial code
6. Then we can start building the actual features

Here's what I want to build:
[DESCRIBE YOUR APP IDEA HERE]
```

---

## Example: Full Flow

```
You: "I want to create a new app from this template.

Please read AGENT.md to understand the template structure and 
onboarding process, then ask me the required questions.

Here's what I want to build:
A personal finance tracker where I can log expenses, 
categorize them, and see monthly spending breakdowns."

Agent: "I've read the template docs. Great idea! Let me gather 
some info to set everything up:

1. App name? (e.g., 'SpendTracker', 'Budget Buddy')
2. Your email for the admin account?
3. Password? (changeable later in Settings)
4. Database region? (default: us-east-1)
5. Color scheme? (default: emerald, or maybe blue for finance?)

Once you answer, I'll create your Supabase project, set up 
the database, and we can start building!"

You: "1. MoneyMap
2. david@example.com
3. MySecurePass123
4. us-east-1 is fine
5. Let's do blue"

Agent: [Creates Supabase project]
       [Runs migrations]
       [Creates your account]
       [Updates app name to 'MoneyMap']
       [Updates color scheme to blue]
       [Creates GitHub repo 'money-map']
       [Pushes initial code]
       
       "All set! MoneyMap is ready. Your Supabase project is 
       created, you can log in with david@example.com.
       
       Now let's build the features. Based on your description,
       I'm thinking:
       - Expenses tab with a table to log transactions
       - Categories management
       - Monthly breakdown with charts
       
       Should I start with the Expenses tab?"
```

---

## What Gets Created

After the setup, you'll have:

| Item | Location |
|------|----------|
| New Supabase project | supabase.com (your dashboard) |
| New GitHub repo | github.com/your-username/app-name |
| Local project folder | Where you cloned it |
| Your user account | In the new Supabase Auth |
| Database tables | user_settings + your app tables |

---

## Quick Reference: Template Features

The template comes with:
- ✅ Supabase Auth (login/logout)
- ✅ Settings page (profile, preferences, password)
- ✅ Tab-based navigation
- ✅ Collapsible modules
- ✅ Toast notifications
- ✅ Dark theme with customizable colors
- ✅ Responsive (desktop sidebar, mobile drawer)
- ✅ 10 UI patterns to reference (Patterns tab)
- ✅ Scaffolds folder with reusable components

---

## Troubleshooting

**"Supabase MCP not working"**
- Make sure you have the Supabase MCP configured in Cursor settings
- Check that your Supabase access token is valid

**"Can't create more projects (free tier limit)"**
- Supabase free tier allows 2 active projects
- Pause old projects you're not using
- Or upgrade to Pro for unlimited

**"Agent doesn't understand the template"**
- Make sure AGENT.md is in the project root
- Tell the agent: "Please read AGENT.md first"
