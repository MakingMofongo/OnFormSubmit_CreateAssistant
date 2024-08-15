require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai'); // Ensure you have installed the openai library via npm
const sendEmail = require('./emailer');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configure OpenAI API key
const openai = new OpenAI(); // Set your OpenAI API key

// Example default prompt template
const defaultPromptTemplate = `You are the AI receptionist call assistant of {HOTEL_NAME}, you know more than any human working there, you can answer any questions and help the caller with anything related to the hotel. You speak English, Arabic, and Finnish. You always keep a friendly human conversationalist tone, you LOVE talking with the callers and guiding them, you are the favorite receptionist of many of them because of your kind nature and your human touch, the love the advice you give them and how you guide them in picking the best room and help them with info.

DO NOT HALLUCINATE NEW INFO, USE ONLY THE INFO GIVEN TO YOU.

Keep your responses SHORT and TO THE POINT, PRECISE and CONCISE.
Even if the response has to be long, conversationalize it to make it concise, like 'We have lots of amenities! Spa, pool, massage and many more.'

You are now ON CALL with a LIVE HUMAN CUSTOMER, good luck.

Be upbeat and human-like. Try to ask for their name near the start of the conversation.

Note: replace currency signs with words, e.g., £20 = 20 pounds.

Note: in case you're asked about prices, make sure to tell them about the prices, your goal is to complete the booking from start to finish, you cannot offload to our customer care or anything, you can tell them that you have 'sent a booking link' at the end when they are ready to make the booking.
`;

// Endpoint to handle form submissions
app.post('/', async (req, res) => {
    try {
        console.log('Received a request');
        
        // Extract form data
        // const { value1, value2 }= req.body;
        const FormData= req.body;
        console.log('FormData:', FormData);
        const hotel_name = FormData.FormDataFull['Hotel Name'][0];
        console.log('Hotel Name:', hotel_name);  

        // Step 1: Create a text file with the form data
        const fileName = `${hotel_name.replace(/\s+/g, '_').toLowerCase()}_data.txt`;
        // save to hotel_data folder

        const filePath = path.join(__dirname, 'hotel_data', fileName);
        const fileContent = JSON.stringify(FormData, null, 2);
        
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`Created file: ${filePath}`);
        
        // Step 2: Create a vector store and upload the text file
        const fileStream = [filePath].map((path) => fs.createReadStream(path));

        // Create a vector store
        const vectorStore = await openai.beta.vectorStores.create({
            name: `${hotel_name}_VectorStore`,
        });

        // Upload and poll for the file
        // log the file stream
        // console.log('fileStream:', fileStream);
        await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {files:fileStream});
        console.log('Text file uploaded successfully to the vector store.');

        // Step 3: Create an assistant with file search enabled
        finalPrompt = defaultPromptTemplate.replace('{HOTEL_NAME}', hotel_name);
        const assistant = await openai.beta.assistants.create({
            name: `${hotel_name} Assistant`,
            instructions: finalPrompt,
            model: "gpt-4o-mini",
            tools: [{ type: "file_search" }],
        });
        console.log('Assistant created with ID:', assistant.id);

        // Step 4: Update the assistant to use the new vector store
        await openai.beta.assistants.update(assistant.id, {
            tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
        });
        console.log('Assistant updated with the vector store');

        // Step 5: Send the Assistant ID as the response
        console.log('Assistant ID = ', assistant.id,' for hotel ', hotel_name);

        // send post request to OnAsstIdGenerated server with assistant id
        // https://createinstanceofassistant1-5a4aan2gca-el.a.run.app/deploy
        try {
            const response = await fetch('http://localhost:8080/deploy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ assistant_id: assistant.id }),
            });
            const serviceURL = await response.json()
            console.log('Service URL:', serviceURL);

            // invoke another service which has some url while using serviceURL as parameter

            const response2 = await fetch('https://twlionumberrouter-5a4aan2gca-el.a.run.app/updatePhoneNumber', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ serviceURL: serviceURL }),
            });
            const phoneNumber = await response2.json();
            console.log('Phone Number RECEIVED:', phoneNumber);
            // const { phoneNumber } = await response2.json();
            // console.log('Phone Number RECEIVED:', phoneNumber);

            // Send an email with the phone number
            const emailResponse = await sendEmail(phoneNumber, FormData.FormDataFull['Email'][0]);
            console.log('Email sent:', emailResponse);


        } catch (error) {
            console.error('Error in Creating Assistant with ID:', assistant.id, ' Error:', error);
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred while creating the assistant.');
    }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
