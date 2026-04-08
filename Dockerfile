# 1. Node.js ka official aur halka version use karein
FROM node:18-alpine

# 2. Container ke andar ek folder banayen jahan code rakha jayega
WORKDIR /app

# 3. Pehle sirf package.json copy karein taake install fast ho
COPY package*.json ./

# 4. Saari dependencies (node_modules) install karein
RUN npm install

# 5. Apna baqi saara code container mein copy karein
COPY . .

# 6. Back4app ko batayen ke app kis port par chalegi
EXPOSE 5000

# 7. App ko start karne ka command
CMD ["npm", "start"]