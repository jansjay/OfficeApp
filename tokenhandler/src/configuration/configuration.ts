import {ApiConfiguration} from './apiConfiguration';
import {ClientConfiguration} from './clientConfiguration';
import {HostConfiguration} from './hostConfiguration';
import {LoggingConfiguration} from './loggingConfiguration';

/*
 * A holder for configuration settings
 */
export interface Configuration {

    host: HostConfiguration;

    api: ApiConfiguration;

    client: ClientConfiguration;

    logging: LoggingConfiguration;
}
