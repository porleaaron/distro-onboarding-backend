import { ApolloServer } from "apollo-server-lambda";
import { RESTDataSource } from "apollo-datasource-rest";

const WeatherDataSource = class extends RESTDataSource {
    constructor() {
        super();
        this.baseURL = "https://api.weatherapi.com/v1/";
    }

    async getWeather(city : string) {
        return this.get(`current.json?key=a645a79e5a0d4080b53102400220807&q=${city}&aqi=no`);
    }
};

const server = new ApolloServer(
    {
        typeDefs: `
        
            type Weather {
                temperature : Float
                icon : String
                xx : String
            }
              
             type Query {
                    weather(city : String) : Weather
              }
            `,

        resolvers: {
            Query: {

                weather: async (source : any, input : any, context : any) => {

                    try {
                        const json =  await context.dataSources.weather.getWeather(input.city);

                        return {
                            temperature : json.current.temp_c,
                            xx  : 12,
                            icon : json.current.condition.icon
                        }
                    } catch (e) {
                        return {temperature : 0, icon : ''}
                    }

                },

            },
        },
        dataSources: () => ({
            weather : new WeatherDataSource()
        })
    }
);

exports.main = server.createHandler();


